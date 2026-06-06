# F10 — Listmonk : observabilité de la sync & dégradations honnêtes

> **Intention** : rendre Listmonk *visible* quand il va mal. Aujourd'hui une
> panne Listmonk est silencieuse partout sauf dans les logs serveur : le
> HealthBadge reste vert (LMK-01), « Dernière synchro » affiche `updatedAt` même
> si le poll a échoué (LMK-02), le wizard prétend qu'« aucune liste n'existe »
> alors que Listmonk est juste injoignable (LMK-04), la CSP est strippée sans
> resynthèse (LMK-05) et aucun historique de sync n'est conservé (LMK-06).
> F10 ferme ces six trous **sans changer le pipeline d'envoi** : on n'ajoute que
> de l'observabilité (3 timestamps additifs, un check santé, des badges) et de
> l'honnêteté d'affichage.
>
> Refs audit : `LMK-01 LMK-02 LMK-03 LMK-04 LMK-05 LMK-06`
> Features inventaire : `LMK-F01 LMK-F02 LMK-F03 LMK-F04 LMK-F05`
> Code cible :
> `lib/mail/campaigns/listmonk-status-sync.ts` (écrivain),
> `app/api/admin/emails/health/checks.ts` (check),
> `components/admin/emails/HealthBadge.tsx` (rendu santé),
> liste & détail campagne, wizard `CampaignWizard.tsx`,
> `app/admin/emails/listmonk/[[...path]]/page.tsx` + `ListmonkFrame.tsx`,
> `app/api/listmonk/[...path]/route.ts` (proxy).

---

## 1. Persistance de la sync — sémantique des 3 timestamps

Migration **additive** (cf. `02-modele-donnees.md` §F10) sur `email_campaign_link` :

```sql
ALTER TABLE email_campaign_link ADD COLUMN IF NOT EXISTS last_sync_attempt_at timestamptz;
ALTER TABLE email_campaign_link ADD COLUMN IF NOT EXISTS last_sync_ok_at      timestamptz;
ALTER TABLE email_campaign_link ADD COLUMN IF NOT EXISTS last_sync_error      text;
```

`syncCampaignStatuses()` (le poll cron + le bouton « Rafraîchir ») écrit ces
trois champs **à chaque passage sur chaque campagne candidate**. Sémantique
exacte (c'est elle qui rend les badges fiables) :

| Champ | Quand | Règle |
|---|---|---|
| `last_sync_attempt_at` | **À CHAQUE tentative**, succès OU échec | écrit *systématiquement*, avant le `try`/dans le `finally` — un timestamp d'attempt qui ne bouge pas trahit un cron mort. |
| `last_sync_ok_at` | **Uniquement** si le `listmonk.campaigns.get()` réussit | mis à `now` sur succès ; **inchangé** sur échec (on garde la trace du dernier OK). |
| `last_sync_error` | **Uniquement** sur échec | = message d'erreur **tronqué à 500 caractères** ; **remis à `null`** sur succès. |

**Invariants (table de vérité partielle) :**
- `ok` et `error` sont **mutuellement exclusifs sur un passage donné** : un
  succès met `ok=now` ET `error=null` ; un échec met `error=<msg>` et laisse
  `ok` à sa valeur antérieure.
- `attempt_at >= ok_at` toujours (un attempt accompagne ou précède chaque ok).
- `last_sync_error != null` **n'implique pas** que la dernière tentative a
  échoué dans l'absolu — il faut le croiser avec `attempt_at > ok_at` (cf. §3).
  En pratique l'écrivain garantit `error=null` sur succès, donc
  `error != null  ⟺  dernière tentative en échec`. Le badge s'appuie sur cette
  garantie ET la double-vérifie via `attempt > ok` (défense en profondeur).
- Une campagne **jamais synchronisée** (legacy / sans `listmonk_campaign_id`)
  a les trois champs à `null` → **aucun badge** (on n'invente pas une panne).

**Troncature** : `last_sync_error = String(err).slice(0, 500)`. Au-delà de 500
caractères, on garde le préfixe (le message Listmonk/timeout commence par
l'essentiel : `ListmonkTimeoutError: …`, `Listmonk 503 on /api/campaigns/777 …`).

**Écriture robuste** : la mise à jour des 3 colonnes ne doit **jamais** être
court-circuitée par l'échec de la lecture Listmonk. Structure cible :

```
for (const c of candidates) {
  const now = new Date();
  const base = { last_sync_attempt_at: now };           // systématique
  try {
    const res = await listmonk.campaigns.get(...);       // peut throw (timeout/4xx/5xx)
    // … métriques + transition légale (inchangé) …
    set = { ...metrics, ...transition, last_sync_ok_at: now, last_sync_error: null };
  } catch (err) {
    errors += 1;
    set = { last_sync_error: String(err).slice(0, 500) }; // ok_at NON touché
  }
  await db.update(...).set({ ...base, ...set });           // un seul UPDATE/candidat
}
```

Conséquence : même un `ListmonkTimeoutError` laisse une **trace persistée**
(attempt avance, error renseignée, ok figé) — fin de LMK-06.

---

## 2. Check santé Listmonk dans le HealthBadge (LMK-01)

Deux nouvelles lignes dans le rapport santé (`checks.ts`), worst-wins avec
l'existant, rendues par `HealthBadge` :

### 2.1 Ping Listmonk (« joignable »)
- Source : `listmonk.meta.serverInfo()` (= `GET /api/health`) **avec un timeout
  court dédié de 3 s** (PAS le `LISTMONK_TIMEOUT_MS=10s` du client métier : le
  dashboard ne doit pas suspendre 10 s sur Listmonk gelé). On enveloppe l'appel
  dans un `AbortSignal.timeout(3000)` propre au check.
- Niveaux :
  - `ok` : réponse 2xx **et** latence < 1000 ms → « ✓ joignable (87 ms) ».
  - `degraded` : réponse 2xx mais latence ≥ 1000 ms (lent) → « ⚠ lent (1 240 ms) ».
  - `incident` : timeout (3 s dépassé) / erreur réseau / non-2xx → « ✗ injoignable ».
- Le check est **non bloquant et caché** : son résultat alimente le rapport
  santé qui est déjà mis en cache (TTL court, cf. risques §8) — on ne paie pas le
  ping à chaque rendu.

### 2.2 Âge du dernier sync OK (« métriques à jour ? »)
- Source : `max(last_sync_ok_at)` et `count(*) WHERE last_sync_error IS NOT NULL
  AND last_sync_attempt_at > last_sync_ok_at` sur les campagnes **non
  terminales** (`status IN ('sending','scheduled')`) — agrégat SQL, pas de
  fetch de lignes.
- Niveaux :
  - `ok` : dernier OK < 1 h **et** 0 campagne en échec → « ✓ dernier poll 14:31 ».
  - `degraded` : dernier OK entre 1 h et 6 h, OU au moins 1 campagne non
    terminale en échec → « ⚠ N en échec / dernier OK il y a 2 h ».
  - `incident` : dernier OK > 6 h alors que des campagnes non terminales
    existent (le poll ne tourne plus) → « ✗ sync à l'arrêt ».
  - **Base calme** (aucune campagne non terminale) → `ok` neutre, **jamais
    rouge** (rien à synchroniser ≠ panne).
- Deep-link `?from=health` vers la liste campagnes filtrée sur les sync KO.

Les deux lignes apparaissent dans le `<ul>` déroulé du badge avec ✓/✗ et,
quand ✗, une ligne d'action (lien deep-link) — exactement le pattern des checks
infra existants (webhook, cron, DLQ).

---

## 3. Badges « sync en échec » & « métriques périmées » (liste + détail) — LMK-02/06

### 3.1 Table de vérité des badges (par campagne)
Soit `attempt`, `ok`, `error` les 3 champs, `now` l'instant, `terminal` =
`status ∈ {sent, cancelled, failed}` (une campagne terminale n'est plus
synchronisée → ses métriques sont définitives, pas « périmées »).

| attempt | ok | error | terminale | Badge | Libellé |
|---|---|---|---|---|---|
| null | null | null | — | **aucun** | (jamais syncée / legacy) |
| set | set | null | non | **aucun** si `now-ok ≤ 1h` | sync saine |
| set | set | null | non | **Métriques périmées** (amber) si `now-ok > 1h` | « ⚠ métriques périmées (>1h) » |
| set | set | null | **oui** | **aucun** | terminale → jamais « périmé » même si `now-ok > 1h` |
| set | any | **non-null** & `attempt>ok` | non | **Sync en échec** (rose) | « ⚠ sync en échec » |
| set | any | **non-null** & `attempt>ok` | **oui** | **aucun** | terminale → on n'alerte plus |
| set | null | non-null | non | **Sync en échec** (rose) | jamais réussi à synchroniser |

**Règles consolidées :**
- **« Sync en échec »** SSI `error != null` **ET** `attempt > ok` (ou `ok` null)
  **ET** campagne **non terminale**.
- **« Métriques périmées >1h »** SSI `error == null` **ET** `ok != null` **ET**
  `now - ok > 1h` **ET** campagne **non terminale**.
- Les deux badges sont **exclusifs** : en échec prime sur périmé (si on est en
  échec, le périmé est une conséquence redondante — on n'affiche que la cause).
- Campagne **terminale** → **aucun** badge sync (cas piège classique : une
  campagne `sent` il y a 3 jours ne doit pas crier « périmé »).

### 3.2 Liste campagnes
Une pastille (`Pill` tone `danger`/`warning`) **par ligne uniquement si** un
badge s'applique (sinon rien — pas de bruit visuel sur les lignes saines).
Le badge est en plus du `Pill` de statut existant, jamais à sa place.

### 3.3 Détail campagne
- Cas sain : ligne neutre « Dernière synchro réussie : 06/06 14:31 (poll cron) »
  (heure absolue via formateur TZ central + Freshness « il y a N min »).
- Cas **en échec** : bandeau amber/rose role=alert
  « ⚠ Dernier essai 06/06 14:36 : {error tronquée} — métriques potentiellement
  périmées. [Réessayer maintenant] ». Le message d'erreur affiché est
  `last_sync_error` (déjà tronqué côté écriture).
- Cas **périmé sans erreur** : bandeau amber léger « Métriques datant de plus
  d'une heure (dernier poll 12:58). [Réessayer maintenant] ».
- Le bouton **[Réessayer maintenant]** POST vers l'action de sync ciblée
  (re-poll de CETTE campagne) → applique la **grille réseau** complète
  (200 / 401 / 422 / 500 / hang / network) : busy + libellé « Synchronisation… »
  + `aria-busy` + un seul POST sur double-clic ; succès → toast vert + le bandeau
  disparaît / se met à jour ; échec → toast erreur role=alert persistant, le
  bandeau reste, **rien n'est faussement « réussi »**.

---

## 4. Wizard honnête quand Listmonk est down (LMK-04)

Le wizard reçoit déjà `listmonkError: string | null` (RSC) et les `lists` /
`templates`. Aujourd'hui, à l'étape 2, si `lists` est vide il affiche
**toujours** « Aucune liste Listmonk. Crée-en une dans /listmonk » — y compris
quand `lists` est vide *parce que Listmonk a timeout* (LMK-04 : le faux hint).

**Règle corrigée (étape 2 — audience / listes Listmonk) :**

| `listmonkError` | `lists.length` | Affichage |
|---|---|---|
| `null` | 0 | hint création **normal** : « Aucune liste Listmonk. Crée-en une dans … » |
| `null` | > 0 | la liste des cases à cocher (nominal) |
| **non-null** | 0 | **message d'indisponibilité** : « ⚠ Listmonk est indisponible ({error}) — les listes ne peuvent pas être chargées. **[Réessayer]** Vous pouvez utiliser une audience FemiGlow. » — **et PAS** le hint « Crée-en une ». |
| non-null | > 0 (cache/partiel) | la liste affichée **+** un avertissement non bloquant « certaines listes peuvent manquer (Listmonk a renvoyé une erreur) ». |

**Règle identique à l'étape 3 (contenu — templates Listmonk) :**
- `listmonkError` non-null & `templates` vide → message d'indispo + Réessayer,
  PAS « aucun template, crée-en un » ; le corps HTML libre reste utilisable
  (le wizard reste fonctionnel avec une audience FemiGlow et un corps libre).
- `listmonkError` null & `templates` vide → hint normal.

**Bouton [Réessayer]** : recharge les listes/templates (re-fetch RSC ou action
client) ; grille réseau ; pendant le hang → « Chargement… » + disabled ; succès
→ les cases apparaissent ; échec → le message d'indispo persiste (pas de faux
succès). Le bandeau d'erreur global existant « ⚠ Listmonk : {err} » en tête
d'étape est conservé (il situe la cause), mais ne **remplace plus** le hint
trompeur — c'est le bloc liste/template qui devient honnête.

**Invariant clé** : le wizard ne dit JAMAIS « crée-en une » quand la vraie
cause est une panne. Une liste vide ≠ Listmonk down.

---

## 5. Erreurs de push de snapshot détaillées (LMK-04 bis)

`pushSnapshotToListmonk()` pousse les membres un par un (`pushed` compté ;
409 → attach). Aujourd'hui l'alerte wizard est générique (« 0 a/ont pu être
ajouté(s) »). Cible : remonter dans l'alerte le **détail** :
- **tentés** (= nombre de membres du snapshot),
- **rejetés** (= tentés − poussés),
- **premier message d'erreur** rencontré (status HTTP + corps tronqué du
  premier subscriber en échec, ou « timeout Listmonk »).

Affichage cible dans le wizard (role=alert) :
« Échec partiel du push vers Listmonk : 312 tentés · 47 rejetés · premier
rejet : `Listmonk 422 — invalid email`. [Réessayer le push] ». Si 0 poussé :
« Aucun destinataire n'a pu être ajouté à Listmonk ({premier message}) ».
Le résultat doit donc exposer `{ attempted, pushed, rejected, firstError }`
(extension additive de `PushSnapshotResult`). Oracle : l'opérateur lit un
nombre **et** une raison, jamais un « 0 » nu.

---

## 6. Page iframe Listmonk (LMK-03)

`page.tsx` + `ListmonkFrame.tsx`. Deux variables d'environnement :
`LISTMONK_PUBLIC_URL` (origine publique du sous-domaine) et les creds API.

### 6.1 Bouton « Ouvrir dans un nouvel onglet »
- `LISTMONK_PUBLIC_URL` **défini** → bouton **actif**, `href = ${publicOrigin}${path}`,
  `target=_blank rel=noopener`. L'iframe `src` pointe sur la même origine.
- `LISTMONK_PUBLIC_URL` **absent** → bouton **désactivé** (rendu
  `aria-disabled=true`, pas de `href` cliquable) **avec tooltip/title**
  « Indisponible : LISTMONK_PUBLIC_URL non configuré ». Aujourd'hui le bouton
  pointe sur `/api/listmonk${path}` (proxy cassé pour le SPA) → ouvre une page
  blanche : c'est précisément LMK-03 qu'on supprime.

### 6.2 Message d'indisponibilité orienté ops
Quand `LISTMONK_PUBLIC_URL` est absent, à la place de l'instruction `.env`
brute (« Configure LISTMONK_PUBLIC_URL dans apps/web/.env… »), un message
**orienté ops** : « Listmonk n'est pas exposé publiquement. Voir le runbook
*listmonk-subdomain* pour configurer le vhost LiteSpeed. » (l'admin n'a pas à
connaître les noms de variables d'env).

### 6.3 Bandeau « piège » (LMK-03 bonus)
Au-dessus de l'iframe, **toujours** (quand l'iframe est rendue), un bandeau
info : « ⚠ Vous éditez dans Listmonk natif — les campagnes créées ici ne sont
**PAS** visibles dans /campaigns. » C'est le piège classique : un admin crée une
campagne dans Listmonk, la cherche dans le cockpit FemiGlow et ne la trouve pas
(elle n'a pas de `email_campaign_link`). Le bandeau le prévient en amont.

---

## 7. Proxy : resynthèse CSP au lieu du strip (LMK-05)

`app/api/listmonk/[...path]/route.ts`. Aujourd'hui le proxy **supprime**
`x-frame-options` et `content-security-policy` de la réponse Listmonk (pour que
l'iframe ne soit pas bloquée) — strip complet = on retire toute protection de
framing.

**Cible** : ne plus *supprimer purement* la CSP, mais la **resynthétiser** en
une politique de framing minimale et explicite :
- `x-frame-options` : toujours **retiré** (header binaire DENY/SAMEORIGIN sans
  granularité fine — on le remplace par la CSP).
- `content-security-policy` : **remplacé** par
  `content-security-policy: frame-ancestors 'self'` (la réponse proxifiée n'est
  embarquable que par notre propre origine admin — pas par un site tiers).
- `content-security-policy-report-only` : retiré (bruit).

Invariant : la réponse proxifiée porte **toujours** `frame-ancestors 'self'` et
**jamais** `x-frame-options` ni la CSP Listmonk d'origine. Auth (`requireAdmin`
→ 401), injection Basic Auth serveur et `X-Forwarded-User` (audit) : **inchangés**.

---

## 8. Comportements de dégradation — écran par écran (récap)

| Écran | Listmonk down | Comportement cible |
|---|---|---|
| **Dashboard / HealthBadge** | ping 3 s échoue | ligne « Listmonk : ✗ injoignable », niveau `incident` ; ligne « Sync : ✗ … » si campagnes non terminales non syncées. |
| **Wizard é2** | `listmonkError` non-null, listes vides | message d'indispo + **Réessayer**, audience FemiGlow proposée, **pas** de hint « crée-en une ». |
| **Wizard é3** | `listmonkError` non-null, templates vides | idem (indispo + Réessayer) ; corps HTML libre toujours utilisable. |
| **Wizard push snapshot** | push partiel/échec | alerte détaillée tentés/rejetés/premier message + Réessayer. |
| **Liste campagnes** | sync KO persistée | badge « sync en échec » sur les lignes concernées (non terminales). |
| **Détail campagne** | `last_sync_error` set | bandeau « Dernier essai … : {error} — métriques périmées. [Réessayer] ». |
| **Page iframe** | Listmonk mort | la page SSR rend (heading + iframe ou message), **jamais un 500** ; l'iframe ne charge pas son contenu mais le shell reste digne. |
| **Proxy** | upstream KO | 502 « Listmonk upstream error », auth toujours exigée. |

---

## 9. Ce qui doit être vérifié (synthèse des oracles)

1. Les 3 colonnes sont écrites par `syncCampaignStatuses` dans les **3 cas**
   (succès / échec HTTP / timeout) : attempt avance toujours, ok/error exclusifs,
   error tronquée ≤ 500.
2. La table de vérité des badges est respectée **terminale comprise** (pas de
   faux « périmé » sur campagne terminale).
3. Le check santé Listmonk : `ok` joignable rapide, `degraded` lent, `incident`
   injoignable — avec un timeout de **3 s** (le dashboard ne suspend pas 10 s).
4. Le wizard distingue **liste vide** (hint création) de **Listmonk down**
   (indispo + Réessayer), à l'é2 ET l'é3.
5. Le push snapshot remonte tentés/rejetés/premier message.
6. La page iframe : bouton actif+href correct **avec** env, désactivé+tooltip+
   message ops **sans** env, bandeau piège toujours présent.
7. Le proxy : `frame-ancestors 'self'` présent, `x-frame-options` absent, 401
   sans session.
8. E2E (`emails-degraded`, SM-F10-01) : Listmonk port mort → wizard utilisable
   via audience FemiGlow, détail campagne montre l'échec, HealthBadge `degraded`.
