# Étude de faisabilité — Système de webhook sortant

> **Objet.** Concevoir le mécanisme qui transmet automatiquement chaque lead
> reçu par FemiGlow à un serveur tiers, dans un format JSON imposé. Évaluer
> trois approches couvrant **architecture**, **fiabilité**, **sécurité**,
> **observabilité** et **ergonomie d'administration**, les comparer, et
> émettre une recommandation finale. Ce n'est **pas** un plan d'action.

---

## 1. Contexte & contraintes

### 1.1 Format de payload imposé

Référence fournie par le commanditaire :

```json
{
  "id": "cmokk1o9v08cer3tvasgohtw6",
  "ip": "41.251.52.100",
  "ref": "cmokk1o9v08cer3tvasgohtw6",
  "city": "Casablanca",
  "note": "Lancer mon projet E-commerce",
  "email": "",
  "phone": "+212653014133",
  "address": "",
  "country": "Maroc",
  "currency": "MAD",
  "quantity": 1,
  "full_name": "Elhamidi Aziza",
  "product_sku": "ECOM-METHOD",
  "total_price": 3000,
  "product_name": "Formation Ecom Method",
  "source_channel": "site_web",
  "product_variant": "Débutant"
}
```

Lecture de structure :

| Champ | Source dans FemiGlow | Remarque |
|---|---|---|
| `id`, `ref` | `leads.id` (cuid) | identifiant interne stable |
| `ip` | requête HTTP entrante (`x-forwarded-for`) | à capturer côté route handler |
| `city` | `checkoutFormSchema.address.city` | enum villes Maroc |
| `note` | `contactFormSchema.message` | vide si checkout |
| `email`, `phone` | présents dans tous les schémas | normaliser téléphones `+212…` |
| `address` | `address.line1` + `quartier` | concaténation lisible |
| `country` | `"Maroc"` (constante) | site mono-pays |
| `currency` | `"MAD"` (constante) | devise unique |
| `quantity` | `cartItem.quantity` | défaut `1` pour contact / newsletter |
| `full_name` | `firstName + lastName` | trim + collapse espaces |
| `product_sku`, `product_name`, `product_variant` | catalogue mock CMS | mapping table à entretenir |
| `total_price` | `checkout.total` | `0` pour contact / newsletter |
| `source_channel` | `"site_web"` (constante) | extensible plus tard (mobile, B2B…) |

→ La projection `lead → payload` est déterministe. Un seul **mapper**
côté serveur (`mapLeadToWebhookPayload`) suffit ; testable en isolation.

### 1.2 Exigences fonctionnelles

| Exigence | Détail |
|---|---|
| Envoi automatique | dès qu'un lead est persisté, un webhook part vers l'URL configurée |
| Configurabilité | URL cible et secret modifiables sans redéploiement |
| Multi-cibles | possibilité d'avoir plusieurs URLs (prod + staging du partenaire) |
| Filtres | choix : envoyer tous les leads, ou un sous-ensemble (ex. `type === 'order'`) |
| Replay manuel | depuis l'admin, rejouer une livraison ratée d'un clic |
| Désactivation | toggle on/off sans perdre la configuration |
| Visibilité | logs des dernières livraisons (statut HTTP, durée, payload, réponse, tentatives) |

### 1.3 Exigences non fonctionnelles

| Exigence | Cible |
|---|---|
| Fiabilité | aucune perte de lead. Si la cible est down, retry avec backoff exponentiel pendant ≥ 24 h |
| Idempotence | la cible peut recevoir le même `id` plusieurs fois sans effet de bord (header `Idempotency-Key: <lead.id>`) |
| Sécurité | signature HMAC-SHA256 du body avec secret partagé, vérifiable côté receveur |
| Observabilité | chaque tentative tracée : timestamp, statut, latence, réponse |
| Latence côté soumetteur | 0 impact sur le temps de réponse de `POST /api/checkout` (les leads ne doivent pas attendre) |
| Sérialité par lead | les retries d'un même lead ne se chevauchent pas |

### 1.4 Modèle de données implicite

Tout schéma de webhook sortant introduit une table `webhook_endpoints` (la
configuration) et une table `webhook_deliveries` (les tentatives). Voir
`03-faisabilite-gestion-leads.md` § 2.4 pour la philosophie générale —
**chaque lead persisté déclenche zéro à N livraisons**.

```text
webhook_endpoints
├── id (uuid)
├── url (text)
├── secret (text, chiffré at-rest si possible)
├── enabled (bool)
├── filter (jsonb)         -- ex: { "type": ["order"] }
├── created_at, updated_at

webhook_deliveries
├── id (uuid)
├── endpoint_id (fk)
├── lead_id (fk)
├── attempt (int)            -- 1, 2, 3…
├── status ('pending'|'success'|'failed'|'aborted')
├── http_status (int|null)
├── response_body (text|null, tronqué)
├── error_message (text|null)
├── duration_ms (int|null)
├── scheduled_for (timestamp)
├── completed_at (timestamp|null)
```

### 1.5 Contrainte de plateforme

Vercel serverless : pas de processus longue durée, pas d'état mémoire entre
requêtes. Trois conséquences dimensionnantes :
1. Pas de `setTimeout` côté Node pour différer un retry — le runtime sera
   recyclé.
2. Les tâches asynchrones doivent être déléguées (Cron, queue externe, ou
   service tiers).
3. La durée max d'une route serverless est de 10 s (Hobby) à 60 s (Pro). Un
   retry inline avec backoff dépasserait facilement.

---

## 2. Approche A — *Webhook synchrone inline dans le route handler*

### 2.1 Description

Au moment où un lead est inséré en base (par `POST /api/contact` ou
`POST /api/checkout`), le route handler effectue directement, dans la même
requête, un `fetch()` vers l'URL webhook configurée. Pas de queue, pas de
worker, pas d'état intermédiaire.

```ts
// Pseudo-code, après insertion du lead
const lead = await db.insert(leads)…;
const endpoint = await db.query.webhookEndpoints.findFirst({ where: eq(enabled, true) });
if (endpoint) {
  const payload = mapLeadToWebhookPayload(lead);
  const signature = hmacSha256(JSON.stringify(payload), endpoint.secret);
  await fetch(endpoint.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': lead.id,
      'X-FemiGlow-Signature': signature,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });
}
return NextResponse.json({ ok: true, leadId: lead.id });
```

Pour la fiabilité, on entoure d'un `try/catch` qui enregistre la tentative
en table `webhook_deliveries`. En cas d'échec, on **renonce immédiatement** ;
un bouton "rejouer" dans l'admin permet de reprendre manuellement.

### 2.2 Architecture & flux

```text
┌────────────┐     POST       ┌──────────────────┐
│ Visiteur   │ ─────────────▶ │ /api/contact     │
└────────────┘                │  ou /api/checkout │
                              └────────┬─────────┘
                                       │ 1. INSERT lead
                                       │ 2. fetch(webhook.url) ⏱
                                       │ 3. INSERT delivery
                                       │ 4. respond JSON
                                       ▼
                              ┌──────────────────┐
                              │ Serveur partenaire│
                              └──────────────────┘
```

### 2.3 UI / ergonomie d'admin

- Page `/admin/webhooks` : un seul endpoint configuré (URL + secret +
  toggle + filtre de type).
- Page `/admin/leads/[id]` : section *Livraisons webhook* avec table des
  tentatives, bouton "Rejouer" qui déclenche un `POST /api/admin/webhooks/replay`.
- Page `/admin/dashboard` : compteur "livraisons échouées non rejouées".

### 2.4 Sécurité

- HMAC-SHA256 sur le body (header `X-FemiGlow-Signature: sha256=…`).
- `Idempotency-Key: <lead.id>` pour que la cible déduplique.
- Secret chiffré at-rest via `pgcrypto` ou simplement stocké en `env` (un seul
  endpoint).
- TLS implicite (URL `https://…` validée par Zod côté admin).

### 2.5 Forces

- ✅ **Zéro infra supplémentaire** : pas de queue, pas de cron, pas de
  worker, pas de service tiers payant.
- ✅ **Latence minimale en cas de succès** : le partenaire reçoit le lead en
  < 1 s après la soumission.
- ✅ **Code lisible** : un mapper, un fetch, un log. Tient en 80 lignes.
- ✅ **Coût** : 0 €.

### 2.6 Faiblesses

- ❌ **Couplage temporel** : si le partenaire est lent (3 s) ou tombe, la
  réponse à l'utilisateur final est dégradée. On peut mitiger avec un
  `AbortSignal.timeout(5000)`, mais 5 s sur un checkout reste perceptible.
- ❌ **Retry pauvre** : pas de retry automatique. Un blip réseau d'une
  minute = lead perdu jusqu'à action manuelle. Ne respecte pas l'exigence de
  **24 h de retry**.
- ❌ **Risque de double-envoi** : si la requête utilisateur échoue après le
  fetch (timeout côté Vercel), le webhook a peut-être été reçu deux fois sans
  trace.
- ❌ **Backpressure absente** : si le partenaire renvoie 429 / 503, on n'en
  tient pas compte.
- ❌ **Pas de file** → si on ajoute un 2ème endpoint demain, on séquentialise
  en plein milieu d'un POST utilisateur.

### 2.7 Quand cette approche est légitime

- MVP très précoce, partenaire sous contrôle (même équipe), volume < 100/jour,
  pas d'exigence forte de fiabilité 24/7. Ne convient pas pour un
  environnement de production où la perte d'un lead est inacceptable.

---

## 3. Approche B — *Queue persistée en DB + Vercel Cron + worker idempotent*

### 3.1 Description

Au moment où un lead est inséré, on insère également une ligne dans
`webhook_deliveries` avec `status = 'pending'` et `scheduled_for = NOW()`.
Un **Vercel Cron** (toutes les minutes) appelle un endpoint privé
`POST /api/admin/cron/webhook-tick` qui :

1. Sélectionne (avec `FOR UPDATE SKIP LOCKED`) jusqu'à N livraisons dont
   `scheduled_for <= NOW()` et `status = 'pending'`.
2. Pour chaque livraison : projette le payload, signe, `fetch()`, met à jour
   le statut.
3. Si échec : incrémente `attempt`, calcule un nouveau `scheduled_for` selon
   un backoff exponentiel (1 min, 2 min, 5 min, 15 min, 1 h, 6 h, 24 h),
   plafonné à 7 tentatives sur ~36 h, puis `status = 'aborted'`.

Pas de service tiers. Toute la logique vit dans Postgres + un endpoint cron.

### 3.2 Architecture & flux

```text
┌────────────┐       ┌──────────────────┐
│ Visiteur   │──────▶│ POST /api/contact │
└────────────┘       └────────┬─────────┘
                              │ INSERT lead
                              │ INSERT webhook_delivery (pending, scheduled_for=NOW)
                              │ respond 200 ✅ (rapide)
                              ▼

       ┌──────────────────────┐
       │ Vercel Cron (* * * *)│   chaque minute
       └──────────┬───────────┘
                  ▼
       ┌──────────────────────┐
       │ /api/admin/cron/     │  SELECT pending FOR UPDATE SKIP LOCKED
       │   webhook-tick       │  → fetch chacun → UPDATE statut
       └──────────┬───────────┘
                  ▼
       ┌──────────────────────┐
       │ Serveur partenaire   │
       └──────────────────────┘
```

### 3.3 UI / ergonomie d'admin

- Page `/admin/webhooks` : liste d'endpoints (zéro à N), chacun avec URL,
  secret, toggle, filtre, statistiques 24 h (succès / échecs / en attente).
- Page `/admin/webhooks/[id]/deliveries` : tableau filtrable des livraisons,
  badge de statut coloré, expand pour voir payload et réponse.
- Page `/admin/leads/[id]` : section *Webhooks* listant les tentatives par
  endpoint.
- Bouton "Rejouer" → réinjecte une `webhook_delivery` `pending` avec
  `attempt = 1` et `scheduled_for = NOW()`.

### 3.4 Sécurité

- HMAC-SHA256 + `Idempotency-Key`.
- Endpoint `/api/admin/cron/webhook-tick` protégé par header
  `Authorization: Bearer ${CRON_SECRET}` (Vercel injecte ce header
  automatiquement pour ses crons).
- Secrets endpoints chiffrés at-rest via `pgcrypto.pgp_sym_encrypt`.
- Quota d'exécution borné par batch (max 50 livraisons / tick) pour rester
  sous 60 s d'exécution.

### 3.5 Forces

- ✅ **Découplage complet** : la soumission utilisateur ne dépend plus du
  partenaire. Latence de checkout indépendante de l'état du tiers.
- ✅ **Retry automatique pendant 36 h** avec backoff. Le partenaire peut
  être down 6 h sans perte.
- ✅ **Replay one-click trivial** : il suffit de réinsérer une `pending`.
- ✅ **Multi-endpoints** facile : on insère N livraisons à l'insertion du
  lead.
- ✅ **Observabilité riche** : chaque tentative tracée, requêtable en SQL.
- ✅ **Pas de service tiers** : cron Vercel gratuit jusqu'à 2 jobs/jour
  (Hobby) ou illimité (Pro). On reste sur la même DB, le même runtime.
- ✅ **Idempotence native** : `Idempotency-Key: <lead.id>` côté receveur,
  `SKIP LOCKED` côté émetteur.
- ✅ **Souveraineté** : aucune donnée ne transite par un service tiers.

### 3.6 Faiblesses

- ⚠️ **Latence d'envoi** : un lead peut attendre jusqu'à 60 s avant le
  premier tick si on cale le cron à `* * * * *`. Acceptable pour la
  plupart des intégrations (le partenaire n'est pas l'utilisateur final).
- ⚠️ **Vercel Hobby** = 2 cron/jour seulement. Il faut le plan **Pro
  (20 $/mois)** pour `* * * * *`.
- ⚠️ **Code à maintenir** : ~150 lignes pour le tick (sélection, fetch,
  retry, update, error handling). Plus de surface qu'un fetch inline.
- ⚠️ **Lockage DB** : sur volume > 1000/min, `FOR UPDATE SKIP LOCKED` peut
  saturer. Non concerné ici (volume cible : < 60/heure).

### 3.7 Quand cette approche est légitime

- Production avec exigence de fiabilité, volume modéré (jusqu'à
  ~10 000 webhooks/jour), équipe à l'aise avec SQL et Postgres. **Cas
  FemiGlow.**

---

## 4. Approche C — *Service de queue managé (Inngest, Trigger.dev, QStash)*

### 4.1 Description

Plutôt qu'implémenter sa propre queue dans Postgres, on délègue la
mécanique de retry / scheduling à un service spécialisé :

- **Inngest** — event-driven, free tier 50k events/mois.
- **Trigger.dev** — ORM-like jobs, free tier 10k runs/mois.
- **QStash (Upstash)** — file Redis-based pour HTTP callbacks, free tier
  500 messages/jour.

Au moment de l'insertion du lead, on `enqueue` un événement vers le service
choisi. Celui-ci appelle ensuite, avec ses propres règles de retry, un
endpoint privé `POST /api/admin/queue/deliver-webhook` qui projette le
payload et fait le `fetch()` vers le partenaire.

### 4.2 Architecture & flux (variante Inngest)

```text
┌────────────┐    POST       ┌──────────────────┐
│ Visiteur   │ ───────────▶  │ /api/contact     │
└────────────┘               └────────┬─────────┘
                                      │ INSERT lead
                                      │ inngest.send({ name: 'lead.created', data })
                                      │ respond 200 ✅
                                      ▼
                             ┌──────────────────┐
                             │ Inngest cloud    │
                             │ (retry, schedule)│
                             └────────┬─────────┘
                                      │ HTTP POST signé
                                      ▼
                             ┌──────────────────────────┐
                             │ /api/inngest             │
                             │   step.run('deliver', …) │
                             └────────────┬─────────────┘
                                          │ fetch partner
                                          ▼
                             ┌──────────────────────────┐
                             │ Serveur partenaire       │
                             └──────────────────────────┘
```

### 4.3 UI / ergonomie d'admin

- Configuration de l'endpoint partenaire toujours dans `/admin/webhooks`.
- Logs natifs des retries dans le **dashboard Inngest** (UI tierce, hors
  marque). Pour rester dans l'admin FemiGlow, il faut quand même persister
  une trace locale → on retombe partiellement sur le modèle B.
- Replay : via bouton dans le dashboard Inngest **ou** via un endpoint
  `re-enqueue` côté FemiGlow.

### 4.4 Sécurité

- Inngest signe ses callbacks (header `x-inngest-signature`). Le client
  Inngest valide automatiquement.
- Webhook → partenaire signé en HMAC dans le step `deliver`.
- Secret Inngest stocké en env var (`INNGEST_SIGNING_KEY`).

### 4.5 Forces

- ✅ **Retry et scheduling industriels** : exponentiel, jitter, dead-letter
  queue, fan-out — tout est géré.
- ✅ **Pas de cron à configurer** : le service push vers nous quand il faut.
- ✅ **UI de monitoring fournie** : timeline des runs, logs, replay one-click
  côté Inngest.
- ✅ **Scale-out** : si demain le volume explose à 10k/min, c'est leur
  problème, pas le nôtre.
- ✅ **Plan gratuit suffisant** : Inngest 50k events/mois >> volume FemiGlow
  estimé.

### 4.6 Faiblesses

- ❌ **Souveraineté brisée** : les payloads (incluant emails, téléphones,
  noms — données personnelles RGPD/loi 09-08) transitent par Inngest
  (US/EU). Un DPA est nécessaire ; à valider avec le délégué à la protection
  des données du commanditaire. Le format JSON cible inclut explicitement
  `email`, `phone`, `full_name`, `address`, `ip` → données identifiantes.
- ❌ **Vendor lock-in** : changer de provider = réécrire toute la
  configuration de jobs.
- ❌ **Dépendance externe** : si Inngest a une panne, les webhooks
  s'accumulent chez eux. Visibilité limitée côté FemiGlow.
- ❌ **UI hors marque** : monitoring sur leur dashboard, pas dans l'admin
  FemiGlow → rupture de l'expérience administrateur (cf. invariant audit
  § 14.2).
- ❌ **Coût futur** : la facturation devient lourde au-delà du free tier
  (Inngest 20 $ → 200 $/mois selon les events). Pas un problème immédiat
  mais un vecteur de coût caché.
- ❌ **Sur-ingénierie pour le volume** : 1700 leads/mois max, donc 1700
  webhooks/mois. Inngest est calibré pour 1700/seconde. Marteau / mouche.

### 4.7 Quand cette approche est légitime

- Volume très élevé (> 100k/jour), workflows complexes (chaînage, agrégations,
  fan-out), équipe qui veut éviter de maintenir une queue maison. Pas le cas
  FemiGlow.

---

## 5. Comparatif synthétique

Notation : ✅ avantage, ⚠️ acceptable, ❌ frein.

| Critère | A — Inline | B — DB queue + Cron | C — Service managé |
|---|---|---|---|
| Coût récurrent | ✅ 0 € | ⚠️ 20 $/mois (Vercel Pro) ou 0 si Cron quotidien | ⚠️ 0 → 20 $ → 200 $ selon volume |
| Souveraineté données | ✅ totale | ✅ totale | ❌ payloads transitent par tiers |
| Retry automatique | ❌ aucun | ✅ 7 tentatives sur 36 h | ✅ industriel |
| Latence checkout | ❌ couplée au partenaire | ✅ découplée | ✅ découplée |
| Idempotence | ⚠️ header seul | ✅ `SKIP LOCKED` + header | ✅ géré par le service |
| Multi-endpoints | ❌ difficile | ✅ trivial (N rows) | ✅ trivial |
| Observabilité in-admin | ⚠️ table simple | ✅ table riche, requêtable | ❌ dashboard externe |
| Replay one-click | ⚠️ manuel basique | ✅ insert pending | ✅ via dashboard |
| Code à maintenir | ✅ ~80 lignes | ⚠️ ~150 lignes | ⚠️ ~100 lignes + définitions de jobs |
| Vendor lock-in | ✅ aucun | ✅ aucun | ❌ fort |
| Cohérence brand UI | ✅ admin only | ✅ admin only | ❌ split entre admin et dashboard tiers |
| Complexité ops | ✅ nulle | ⚠️ cron à configurer | ⚠️ comptes / DPA / signing keys |
| Conformité RGPD/09-08 | ✅ | ✅ | ⚠️ DPA requis |
| Scaling > 10k/jour | ❌ écroule la requête utilisateur | ⚠️ tunable (batch size) | ✅ natif |
| Adapté au volume FemiGlow | ⚠️ trop fragile | ✅ idéal | ❌ surdimensionné |
| Effort setup initial | ✅ < 1 jour | ⚠️ ~2 jours | ⚠️ ~1.5 jour + DPA |
| Indépendance plateforme | ✅ totale | ✅ totale | ❌ liée à Inngest |

---

## 6. Lecture transversale

### 6.1 Sur la fiabilité

A perd des leads silencieusement en cas de panne réseau de quelques
minutes. C'est rédhibitoire en prod : un lead checkout = 100-500 €
potentiels. B et C survivent à des pannes longues. **B et C éliminés
de la zone "non viable"** après ce critère.

### 6.2 Sur la souveraineté

Les payloads contiennent `email`, `phone`, `full_name`, `address`, `ip` —
données personnelles directement identifiantes. La loi 09-08 marocaine et
le RGPD imposent une base légale et, pour C, un DPA avec le sous-traitant.
A et B gardent toutes les données dans le périmètre Vercel + Postgres
(eux-mêmes sous engagement RGPD via leurs DPA standards). C ajoute un
3ème acteur dont le DPA et la localisation des datacenters doivent être
validés. **Pour FemiGlow, B simplifie la conformité.**

### 6.3 Sur l'expérience administrateur

L'invariant § 14.2 de l'audit demande une UI cohérente avec la voix de
marque (typographie Cormorant + Inter, palette earthen). C disperse
l'admin entre `/admin/webhooks` (FemiGlow) et `app.inngest.com` (Inngest)
— rupture esthétique et cognitive. B garde tout dans `/admin/*`.

### 6.4 Sur le coût total

| Approche | Setup | Récurrent | TCO 12 mois |
|---|---|---|---|
| A | 1 j-h | 0 € | ~600 € (1 j-h) |
| B | 2 j-h | 240 $ (Vercel Pro)¹ | ~1450 € |
| C | 1.5 j-h + DPA | 0–240 $ | ~900–1140 € |

¹ Vercel Pro est de toute façon nécessaire pour les ENV vars de production
sécurisées et les domaines custom production. Le coût du cron est donc
**marginal**.

### 6.5 Sur l'évolutivité

Si demain un 2ème partenaire est ajouté (ex. CRM Hubspot en plus du serveur
de leads existant), B encaisse trivialement (`webhook_endpoints` est multi-
row). A nécessite une refonte. C nécessite la création d'un nouveau job
Inngest. **B est le plus extensible sans coût supplémentaire.**

### 6.6 Sur la sur-ingénierie

L'invariant § 14.4 (cohabitation avec marketing, pas de stack parallèle) et
la philosophie générale du projet (lent, sobre) plaident contre C. Inngest
brille à 1000 events/seconde ; on en a 1 toutes les 30 minutes en moyenne.
Le coût cognitif d'un service supplémentaire (DPA, monitoring tiers, signing
keys, comptes) ne se justifie pas.

---

## 7. Recommandation finale

### Approche **B — Queue persistée en DB + Vercel Cron + worker idempotent**

#### 7.1 Pourquoi

1. **Fiabilité** : les retries automatiques sur 36 h éliminent la perte
   silencieuse de lead, qui est le risque #1 en prod pour ce système.
2. **Souveraineté** : aucune donnée personnelle ne sort du périmètre Vercel
   + Postgres déjà couvert par les DPA standards. Conformité RGPD / loi
   09-08 simplifiée.
3. **Cohérence UI** : tout vit dans `/admin/*`. L'administrateur consulte
   les leads, les livraisons et leur historique au même endroit, dans la
   même typographie.
4. **Pas de service tiers** : aucune dépendance externe à provisionner /
   maintenir / résilier en cas de pivot.
5. **Coût marginal** : Vercel Pro est de toute façon requis pour la prod
   (env vars, domaines custom, analytics) ; les crons sont gratuits dans
   ce plan. Coût supplémentaire spécifique au webhook : 0 €.
6. **Volume idéal** : 250 — 1700 leads/mois est exactement la zone de
   confort de Postgres + Vercel Cron sans ajustement.
7. **Réutilise le socle** déjà recommandé pour la gestion des leads
   (`docs/admin/03-faisabilite-gestion-leads.md` § A) — Postgres + Drizzle.
   Mutualisation de l'ORM, des migrations, du backup, du monitoring.
8. **Évolutif** : si demain on ajoute un 2ème ou 3ème endpoint
   (CRM, mail provider, analytics), c'est une row de plus dans
   `webhook_endpoints`. Aucune refonte.
9. **Replay trivial** : un bouton dans `/admin/leads/[id]` insère une
   `webhook_delivery` `pending` ; le prochain tick la traite.
10. **Observabilité native** : `webhook_deliveries` est requêtable en SQL,
    affichable dans `/admin`, exportable en CSV. Pas de dashboard tiers à
    apprendre.

#### 7.2 Pourquoi pas A

A semble séduisante par sa simplicité, mais le couplage temporel et
l'absence de retry sont des défauts structurels. Un blip de 30 secondes
chez le partenaire = lead perdu jusqu'à action manuelle. Inacceptable pour
des leads checkout valant potentiellement 500 €. La promesse "envoi
automatique fiable" du commanditaire impose B.

#### 7.3 Pourquoi pas C

C est pensée pour des volumes 1000× supérieurs. Pour FemiGlow elle
introduit un service tiers (Inngest) qui :
- transmet des PII et impose un DPA supplémentaire,
- fragmente l'expérience admin (dashboard externe hors brand),
- crée un vendor lock-in,
- ajoute un coût caché à mesure que le volume grandit.

C devient pertinente seulement si le volume dépasse 100k webhooks/jour ou
si des workflows complexes (fan-out, chaînage, agrégations temporelles)
émergent. Migrer de B → C reste possible plus tard, sans casser l'API
publique : la table `webhook_deliveries` peut être conservée comme
"shadow log" même si Inngest devient l'orchestrateur.

#### 7.4 Architecture finale recommandée (vue d'ensemble)

```text
                  ┌──────────────────────────────────────┐
  POST submit     │  /api/contact, /api/checkout         │
  ─────────────▶  │  └─ INSERT lead                      │
                  │     INSERT webhook_delivery(pending) │
                  │     respond 200 ✅                   │
                  └────────────────┬─────────────────────┘
                                   │
                                   │ stocké en Postgres
                                   ▼
                  ┌──────────────────────────────────────┐
                  │  webhook_deliveries (pending)        │
                  └────────────────┬─────────────────────┘
                                   │
        Vercel Cron (* * * * *)    │
        ─────────────────────────▶ │
                                   ▼
                  ┌──────────────────────────────────────┐
                  │  /api/admin/cron/webhook-tick        │
                  │  ├─ SELECT pending FOR UPDATE SKIP LOCKED │
                  │  ├─ pour chaque : sign + fetch       │
                  │  └─ UPDATE statut + scheduled_for    │
                  └────────────────┬─────────────────────┘
                                   │ HTTPS POST signé HMAC
                                   ▼
                  ┌──────────────────────────────────────┐
                  │  Serveur partenaire                  │
                  └──────────────────────────────────────┘
```

#### 7.5 Décisions d'implémentation actées par cette recommandation

| Décision | Choix |
|---|---|
| Stockage des deliveries | table `webhook_deliveries` dans la même DB que `leads` |
| Orchestration | Vercel Cron `* * * * *` |
| Concurrence | `FOR UPDATE SKIP LOCKED`, batch ≤ 50 |
| Backoff | 1m, 2m, 5m, 15m, 1h, 6h, 24h (7 tentatives, ~36 h) |
| Idempotence | header `Idempotency-Key: <lead.id>` |
| Signature | HMAC-SHA256, header `X-FemiGlow-Signature: sha256=<hex>` |
| Multi-endpoints | oui (table `webhook_endpoints`, N rows) |
| Filtre par endpoint | jsonb `{ "type": ["order"] }` |
| Replay | insert `pending` avec `attempt = 1`, `scheduled_for = NOW()` |
| Configuration UI | `/admin/webhooks` (CRUD + toggle), `/admin/webhooks/[id]/deliveries` |
| Visibilité par lead | section dans `/admin/leads/[id]` |
| Secret endpoint | chiffré at-rest (`pgcrypto.pgp_sym_encrypt`) ou env var si endpoint unique |
| Conformité | aucun tiers → DPA Vercel + Neon/Vercel Postgres suffisent |

---

## 8. Risques résiduels & mitigations

| Risque | Probabilité | Mitigation |
|---|---|---|
| Le partenaire change de format | moyenne | mapper isolé `mapLeadToWebhookPayload`, testé unitairement, versionnable (`v1`, `v2`) |
| Vercel Cron en panne | très faible | fallback : commande CLI `pnpm webhook:tick` exécutable depuis local |
| Backlog de pending > batch size | faible | augmenter batch size (50 → 200) ou fréquence cron (Pro permet `*/30 * * * * *` non, mais on peut chaîner plusieurs crons) |
| Secret HMAC compromis | faible | rotation du secret côté `webhook_endpoints` ; livraisons en cours échouent et retry avec nouveau secret |
| Partenaire retourne 200 sans traiter | faible | hors périmètre côté FemiGlow ; à couvrir par convention (ex. exiger 201 + corps `{ received: true }`) |

---

## 9. Conclusion

**Approche B retenue.** Elle offre le meilleur ratio fiabilité / coût /
souveraineté / cohérence pour le profil FemiGlow. Elle réutilise
intégralement le socle Postgres + Drizzle déjà retenu pour la gestion des
leads. Aucune dépendance externe, aucun DPA supplémentaire, UI 100 % dans
la marque. Migration future vers C reste ouverte si le volume l'exige —
sans réécrire les leads ni le mapper.
