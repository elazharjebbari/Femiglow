# F03 — Dashboard `/admin/emails` : fonctionnement optimal

> Périmètre : sélecteur de fenêtre (DSH-F02), KPI livraison tri-état (DSH-F03),
> sparklines + tendances (DSH-F04), auto-refresh 60 s (DSH-F05), alerte livraison
> silencieuse (DSH-F06), HealthBadge deep-links contextualisés (DSH-F07),
> EmptyState table derniers envois (DSH-F08), loading/error boundaries (DSH-F09),
> compteur en attente avec âge (DSH-F10), cartes cliquables (DSH-F01).
> Problèmes audit traités : DASH-01..DASH-12, TRV-04.
>
> Doctrine : oracles **binaires**, vue opérateur. Tout sous-texte de carte est
> **déterministe** (jamais de point d'interrogation laissé à l'opérateur).

---

## 0. Vue d'ensemble du flux de données

Le dashboard reste un RSC `force-dynamic`. La nouveauté F03 : les chiffres de
fenêtre et les séries proviennent désormais de l'endpoint **summary** du cockpit
(`/api/admin/emails/transactional/summary?window=`), réutilisé plutôt que dupliqué
(DASH-06). Deux modes de consommation cohabitent :

1. **Render RSC initial** : `page.tsx` lit `?window=` (searchParams), appelle
   `summarizeOutbox(window)` côté serveur + `checkEmailingHealth()` +
   `checkEmailingInfraHealth()` + `listRecentOutbox({ limit: 8 })`. Les cartes
   sont peintes complètes dès le premier octet (pas de flash de chargement).
2. **Auto-refresh client** (DSH-F05) : un composant client `DashboardAutoRefresh`
   appelle `router.refresh()` toutes les 60 s → re-render du segment RSC, donc
   re-lecture serveur. L'âge affiché (« à jour il y a Xs ») court en continu côté
   client entre deux refresh.

La fenêtre courante (`24h | 7d | 30d`) est portée par l'URL (`?window=`) et
**partagée** avec le cockpit : un opérateur qui clique une carte arrive dans le
cockpit sur la même fenêtre.

> **Note contrat** : l'enum summary actuel est `1h | 24h | 7d`. F03 l'**étend** à
> `24h | 7d | 30d` (le dashboard n'expose pas `1h`, le cockpit garde `1h`). Voir
> `02-spec-technique.yaml` §summary pour la stratégie d'union d'enum sans casser
> le cockpit.

---

## 1. Sélecteur de fenêtre (DSH-F02 — DASH-01)

### Comportement

- 3 boutons segmentés : `24 h` · `7 j` · `30 j`. Rôle `radiogroup` /
  `radio` ; le sélectionné porte `aria-checked="true"`.
- **Persistance URL** : le clic pousse `?window=24h|7d|30d` (replace, pas push —
  on ne pollue pas l'historique de navigation arrière). Au rechargement, la valeur
  est relue depuis l'URL.
- **Valeur par défaut** : `7d` (continuité avec l'écran historique « 7 derniers
  jours »). `?window=` absent OU invalide → `7d`, sans erreur visible.
- Changer de fenêtre **rafraîchit les données** (nouveau `summarizeOutbox`) ET
  **propage la fenêtre aux liens de drill-down** des cartes (cockpit ouvert sur la
  même fenêtre).

### À vérifier

- **Data** : `?window=30d` → bornes SQL `[now-30j, now]` exactes (test intégration
  avec lignes posées à cheval sur la borne, cf. §summary).
- **Design** : le bouton actif a un état visuel distinct ET `aria-checked`.
- **A11y** : navigation clavier flèches dans le radiogroup ; libellé accessible
  « Fenêtre d'observation ».

---

## 2. KPI livraison TRI-ÉTAT (DSH-F03 — DASH-02, TRV-04)

La carte « Livrés » est la pièce centrale. Elle remplace le sous-texte ambigu
`delivery silencieux ? webhook ?` par un sous-texte **déterministe** issu d'une
machine à 3 états. Entrées : `sent` (envoyés dans la fenêtre), `delivered`
(livrés dans la fenêtre), `webhookLastSuccessAt` (horodatage du dernier event
`delivered` reçu, ou `null`).

### Table de vérité (formules exactes)

| # | Condition | Valeur affichée | Sous-texte | Ton |
|---|-----------|-----------------|------------|-----|
| **E1 — Suivi normal** | `delivered > 0` | `{fmt(delivered)}` | `{pct(delivered, sent)} des envoyés` | `neutral` (ou `emerald` si pct ≥ 95 %) |
| **E2 — Webhook muet** | `sent > 0 && delivered === 0 && webhookLastSuccessAt != null` | `0` | `webhook muet depuis {HH:MM}` + lien `[diagnostiquer →]` | `rose` (alerte) |
| **E3 — Non suivi** | fenêtre **sans envoi** (`sent === 0`) OU webhook jamais armé (`sent>0 && delivered===0 && webhookLastSuccessAt == null`) | `—` (tiret) | `non suivi` + tooltip docs | `neutral` (informatif, **pas** alerte) |

Règles dérivées :

- `pct(num, den)` : `den === 0 → '—'` (jamais `NaN %` ni `0.0 %` trompeur). Cf.
  `kpi-format.ts:pct`.
- L'**horodatage** E2 (`{HH:MM}`) est l'heure locale Casablanca de
  `webhookLastSuccessAt`, formatée `HH:MM` (fr-FR). Au-delà de 24 h, on ajoute la
  date courte `JJ/MM HH:MM`.
- **Distinction E2 vs E3** : E2 = « le webhook a déjà fonctionné, il s'est tu »
  (panne actionnable, rose) ; E3 = « on n'a jamais rien reçu, ou rien envoyé »
  (pas de panne à crier — tiret neutre). C'est exactement la distinction TRV-04
  « cassé / pas-encore-de-données / non-implémenté ».

### Source des entrées

- `sent`, `delivered` : du summary (`?window=`).
- `webhookLastSuccessAt` : du health/infra. `checkEmailingInfraHealth` expose
  déjà `webhookSilent` ; on l'enrichit (ou on lit `lastDeliveredAt` de
  `checkEmailingHealth`) pour disposer de l'horodatage du dernier succès. Cf.
  `02-spec-technique.yaml`.

### À vérifier

- Les **3 états** sont rendus selon la table de vérité **exhaustive**
  (`sent × delivered × webhook` — table de cas en test unitaire pur).
- **Cohérence** : l'alerte « livraison silencieuse » (§5) apparaît **si et
  seulement si** la carte est en E2 ou E3-webhook-jamais-armé (même prédicat
  `isDeliverySilent` ré-évalué sur la fenêtre courante).
- **A11y** : en E2, le ton rose ne porte pas seul l'info — le texte « webhook
  muet depuis … » est explicite (pas de dépendance couleur).

---

## 3. Sparklines + tendances vs période précédente (DSH-F04 — DASH-06)

Chaque carte chiffrée (Envoyés, Livrés, Échecs) affiche :

- une **sparkline** : 12 buckets de `window/12` (déjà fournis par `summary.sparkline`
  — `{ delivered, failed }[]`). Rendue en `<svg>` inline, `aria-hidden="true"`
  (purement décorative — l'info chiffrée est dans la carte).
- une **tendance** : `% vs période précédente`, issue de `summary.comparison`
  (`deliveredPct`, `failedPct`). Formule de `summary.ts:pctChange` :
  `previous === 0 ? (current > 0 ? 100 : 0) : round((current-previous)/previous*100)`.

### Formules d'affichage de la tendance

| Valeur `pct` | Affichage | Ton du libellé |
|--------------|-----------|----------------|
| `pct > 0` | `+{pct}% vs {libellé période préc.}` | `emerald` si métrique « bonne » (livrés), `rose` si « mauvaise » (échecs) |
| `pct < 0` | `{pct}% vs …` (le signe `-` est dans le nombre) | inverse |
| `pct === 0` | `= vs {période préc.}` | `neutral` |
| `comparison` absent (fenêtre sans comparaison) | `—` (pas de tendance) | `neutral` |

- Libellé période précédente : `24h → « 24 h préc. »`, `7d → « 7 j préc. »`,
  `30d → « 30 j préc. »`.
- **Important** : la sémantique de signe est **par métrique** : `+12 %` de livrés
  est vert (bon), `+1` d'échecs est rose (mauvais). La couleur ne suit pas le signe
  brut mais le sens métier.

### À vérifier

- Sparkline a 12 points exactement (`summary.sparkline.length === 12`), index 0 =
  plus ancien.
- Tendance absente → `—`, jamais `NaN%` ni `+Infinity%`.
- A11y : la sparkline est `aria-hidden`, la tendance est du texte lisible.

---

## 4. Auto-refresh 60 s + âge visible (DSH-F05 — DASH-03, DASH-08)

Composant client `DashboardAutoRefresh` (évolution de `DashboardFreshness`) :

- **Tick 60 s** : `setInterval(() => router.refresh(), 60_000)`. Re-render RSC du
  segment ⇒ nouvelles données, sans reload navigateur.
- **Âge visible en continu** : « ↻ auto · à jour il y a {N} s ({TZ}) ». Le compteur
  `N` s'incrémente **chaque seconde** côté client (tick 1 s d'affichage, distinct
  du tick 60 s de fetch), réinitialisé à 0 à chaque refresh effectif. TZ explicite
  = `Casablanca` (DASH-08, via `<Freshness>` socle TRV-05).
- **Suspension onglet caché** (`visibilitychange`) : quand `document.hidden` passe
  à `true`, l'intervalle 60 s est **mis en pause** (pas de fetch dans un onglet non
  regardé — économie + pas de polling fantôme concurrent avec le cockpit, cf.
  risques `05`). **Mais l'âge continue de courir** : au retour (`hidden → false`),
  l'opérateur lit immédiatement « à jour il y a 247 s » (donnée périmée signalée
  honnêtement) PUIS un refresh est déclenché aussitôt pour rafraîchir.
- **Bouton « Rafraîchir » manuel** conservé (anti double-clic, `aria-busy`),
  réinitialise l'âge.

### Machine de l'âge (oracles binaires)

| Événement | Effet observable |
|-----------|------------------|
| montage | âge = `0 s`, intervalle 60 s armé |
| +1 s (onglet visible) | âge affiché = `1 s` |
| +60 s (onglet visible) | un `router.refresh()` émis, âge revient à `0 s` |
| onglet caché à T | aucun `router.refresh()` émis pendant l'occultation ; l'âge continue de croître |
| onglet ré-affiché à T+247 s | âge affiché ≈ `247 s`, **un** `router.refresh()` émis immédiatement, âge → `0 s` |

### À vérifier

- Avec `vi.useFakeTimers` : exactement **1** refresh à 60 s, 0 avant.
- Onglet caché : **0** refresh pendant l'occultation.
- L'intervalle est **nettoyé** au démontage (pas de fuite de timer).

---

## 5. Alerte livraison silencieuse (DSH-F06)

Bandeau `role="alert"` rose, conditionnel, **au-dessus** des cartes :

- **Apparaît** ssi `isDeliverySilent(sent, delivered)` sur la **fenêtre courante**
  (`sent ≥ 1 && delivered === 0`) — recalculé à chaque changement de fenêtre.
- Texte déterministe : « **Livraison silencieuse** : {fmt(sent)} email(s)
  envoyé(s) sur {libellé fenêtre} mais aucune livraison confirmée — le webhook
  Stalwart est probablement muet. [Vérifier les events delivered →] ».
- Lien → `/admin/emails/events?source=email`.
- **Disparaît** dès que `delivered > 0` OU `sent === 0` (changement de fenêtre
  inclus).

### À vérifier

- Apparition/disparition pilotée **uniquement** par le prédicat (binaire).
- Le libellé de fenêtre dans le texte suit le sélecteur (« sur 24 h » / « sur
  7 j » / « sur 30 j »).
- Cohérence avec la carte Livrés (§2) : bandeau présent ⟺ carte en E2/E3-non-armé.

---

## 6. HealthBadge + deep-links contextualisés (DSH-F07 — DASH-12, DASH-11)

Le `HealthBadge` (`<details>`) reste, avec deux évolutions :

1. **Deep-links `?from=health`** : chaque ligne de check en panne (✗) qui pointe
   vers le cockpit porte désormais `?from=health&check={id}&at={iso}` en plus du
   filtre `?status=`. Exemple : DLQ 24h ✗ → `/admin/emails/transactional?status=dlq&from=health&check=dlq24h&at=2026-06-06T14:32:00Z`.
   Le cockpit (CKP-F15) lit `?from=health` pour afficher sa bannière contextuelle
   « Vous arrivez depuis le check santé … (relevé HH:MM) ».
2. **Contraste** (DASH-11) : le pied de synthèse passe en `rose-800` (ou fond
   blanc) pour franchir le seuil WCAG AA.

Chaque check ✗ qui a une cible reste **une ligne d'action** (lien deep-link). Les
checks rendus (déjà présents) : SMTP, DB, Outbox stuck, DLQ 24h, Pending, Dernier
livré, Fraîcheur livraison, Cron de drain, Webhook (delivered), File outbox en
retard, Sending bloqué. F10 (Listmonk) ajoutera ping + âge sync (hors périmètre
F03 mais le badge doit rester tolérant à des checks supplémentaires).

### À vérifier

- Chaque check est rendu avec son ✓/✗ et, en ✗ ciblable, son lien.
- Tout lien deep-link cockpit porte `?from=health` ET propage `?window=` courant.
- A11y : `<summary>` focalisable, contraste pied ≥ 4.5:1.

---

## 7. EmptyState unifié — table « Derniers envois » (DSH-F08 — DASH-05)

Quand `recent.length === 0`, on remplace la cellule de table texte par le
composant socle `<EmptyState>` (TRV-09) :

- icône 📨, titre « Aucun envoi sur {libellé fenêtre} » (ex. « sur 7 jours »),
  CTA bouton « Ouvrir le cockpit → » vers `/admin/emails/transactional?window={w}`.
- Le libellé de fenêtre est **explicite** (plus de « sur la période » vague).

### À vérifier

- 0 ligne → `<EmptyState>` rendu (pas la `<tr>` texte legacy).
- ≥ 1 ligne → table normale (8 lignes max), `<EmptyState>` absent.
- Le CTA propage `?window=`.

---

## 8. Loading / Error boundaries (DSH-F09 — DASH-09)

- **Loading** (`loading.tsx`) : skeleton 6 cartes + 6 lignes, `role="status"`
  sr-only « Chargement du tableau de bord ».
- **Error** (`error.tsx`) : message **neutre** (DASH-09) — supprime la présomption
  « souvent une base de données momentanément injoignable ». Nouveau texte :
  « Le tableau de bord n'a pas pu être chargé. » + `digest` affiché + bouton
  « Réessayer » (`reset()`) + lien retour `/admin`. Pas d'hypothèse sur la cause.

### À vérifier

- Error boundary affiche le `digest` (corrélation logs) et **aucune** mention de DB.
- Skeleton porte `role="status"`.

---

## 9. Compteur « En attente » avec âge du relevé (DSH-F10 — DASH-04)

Carte « En attente » :

- valeur = `pendingNow` (instantané, pas fenêtré — c'est l'état courant de la file).
- sous-texte **déterministe** : « relevé il y a {N} s · drain 60 s ». `{N}` est
  l'âge du relevé (même horloge que l'auto-refresh §4). Ton ambre si
  `pendingNow > PENDING_AMBER_THRESHOLD` (50).
- Objectif (DASH-04) : éviter que l'opérateur croie le cron cassé alors que le tick
  60 s n'est pas encore passé — le « relevé il y a Xs » contextualise.

### À vérifier

- Sous-texte porte l'âge ET « drain 60 s ».
- Ton ambre franchi au-delà de 50.

---

## 10. Cartes cliquables — drill-down cockpit (DSH-F01)

Inchangé fonctionnellement, mais **enrichi** : chaque carte propage `?window=`
courant vers le cockpit (continuité de fenêtre). Mapping `?status=` :

| Carte | `?status=` cockpit |
|-------|--------------------|
| Envoyés | `sent,delivered` |
| Livrés | `sent,delivered` |
| Échecs | `failed,bounced_soft,bounced_permanent` |
| DLQ | `dlq` |
| En attente | `pending` |
| Total | (inerte — pas de lien) |

Chaque carte cliquable a un `aria-label` chiffré (« Voir les 42 échecs »).

---

## 11. Suppression de la map locale (TRV-07 / DASH-07)

`StatusBadge` local dans `KpiCards.tsx` est remplacé par le `Pill` + `STATUS_META`
unifié du socle (SOC-F06). Libellé « Bounce perm. » → « Bounce permanent »
(DASH-07). Hors batterie F03 cœur (couvert par F01), mais la table « Derniers
envois » du dashboard doit **consommer** le `Pill` socle (test de non-régression
visuel : libellés complets).

---

## 12. Invariants transverses à vérifier (résumé oracles)

- **Data** : somme cohérente — `sent` (carte Envoyés) ≥ `delivered` (carte Livrés)
  sur la même fenêtre ; les chiffres de carte proviennent **du même** appel summary
  (pas de fenêtres mélangées entre cartes).
- **Design** : tons sémantiques uniques (success/danger/warning/info), pas de
  doublon de palette.
- **A11y** : 0 violation axe serious/critical ; sélecteur fenêtre = radiogroup ;
  sparklines `aria-hidden` ; alertes en `role="alert"` ; âge en `aria-live="polite"`.
- **Réseau (client)** : si l'auto-refresh échoue (500/hang/network), le dashboard
  **reste lisible** avec les **dernières données valides** + un bandeau discret
  « rafraîchissement impossible — données figées à HH:MM » ; jamais d'écran blanc,
  jamais de faux « à jour il y a 0 s » sur un refresh raté.
