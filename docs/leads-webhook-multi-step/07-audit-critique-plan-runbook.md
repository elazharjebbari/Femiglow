# 7. Audit critique, plan robuste et runbook d'implementation

Date d'audit : 2026-05-15.

Ce document consolide les fichiers `01-*` a `06-*` et les confronte au code reel du repository. Il doit servir de reference d'implementation. Les documents precedents restent utiles comme contexte, mais ce fichier tranche les points ambigus et corrige les ecarts detectes.

## 1. Cartographie du repository utile a l'objectif

### Stack et conventions

- Monorepo `pnpm`, application principale `apps/web`.
- Next.js 14 App Router, React 18, TypeScript, Tailwind.
- DB via Drizzle, avec deux schemas importes selon les domaines :
  - `lib/db/schema.ts` pour les tables admin/ecommerce/webhooks.
  - `lib/chat/db/schema.ts` pour le chat et `chat_lead`, reutilisee par le checkout wizard.
- Tests :
  - Vitest : `apps/web/vitest.config.ts`, `src/**/*.test.{ts,tsx}`.
  - Playwright : `apps/web/e2e`, config `apps/web/playwright.config.ts`.
  - MSW deja present : `apps/web/src/test/msw/*`.

### Zones backend a modifier

| Zone | Fichiers | Role actuel | Changement attendu |
|---|---|---|---|
| Schema lead | `apps/web/src/lib/chat/db/schema.ts`, `apps/web/drizzle/migrations/*` | `chat_lead` stocke chat + wizard, progression funnel, `abandon_webhook_at` cart | Ajouter timestamps dedies step2 et step1-abandon, indexes et settings |
| Wizard step 1 | `app/api/checkout/lead/route.ts`, `lib/checkout/repos/lead-repo.ts` | Cree `chat_lead` avec `lead_captured_at` | Conserver, ne pas envoyer webhook ici |
| Wizard step 2 | `app/api/checkout/lead/[leadId]/address/route.ts` | Patch adresse, pas de webhook | Dispatcher `lead.step2_completed` idempotent apres PATCH reussi |
| Order | `app/api/checkout/order/route.ts`, `lib/webhooks/outbound/sources/from-order.ts` | Cree commande et envoie webhook | Harmoniser event name et payload conversation conditionnel |
| Chat lead | `app/api/chat/lead/contact/route.ts`, `lib/chat/services/lead-webhook.ts`, `lib/webhooks/outbound/sources/from-chat-lead.ts` | Capture lead + webhook immediat sans `conversation` | Ajouter mapping transcript et limites payload |
| Dispatcher | `lib/webhooks/outbound/*` | HMAC, retry, idempotence, log `outbound_webhook_log` | Reutiliser, ne pas recreer un systeme parallele |
| Cron | `app/api/cron/tick/route.ts`, `lib/webhooks/outbound/cart-abandon-scanner.ts` | Scan cart abandon 30 min dans le cron general | Ajouter scanner step1-abandon borne et configurable |
| Admin queries | `lib/db/queries/leads.ts`, `lib/db/queries/tracking/settings.ts` | Liste leads unifiee, settings consentement | Ajouter vues journey/webhook sans charger tous les leads en memoire a terme |

### Zones frontend/admin a modifier

| Ecran | Etat actuel | Evolution recommandee |
|---|---|---|
| `/admin/leads` | Table simple 5 colonnes, fusion legacy leads + `chat_lead`, QuickView chat | Ajouter KPI compacts, funnel mini, filtres parcours/webhook, colonnes `Parcours` et `Webhook` |
| `/admin/leads/[id]` | Identite, commande, historique, note | Ajouter timeline parcours + resume livraisons webhook |
| `/admin/tracking/settings` | Environnement, consentement, retention, debug | Ajouter section `Leads -> Webhook outbound` |
| `/admin/tracking/logs` | Logs tracking existants | Garder pour tracking; creer une sous-vue dediee webhook si necessaire |
| `/admin/webhooks` | Webhooks entrants/config webhooks existants | Ne pas melanger avec le webhook outbound unique env-based |

## 2. Audit critique du plan existant

### Points solides a conserver

1. Le choix de reutiliser `chat_lead` est bon : il evite une deuxieme table lead pour le wizard et conserve le lien chat/session/conversation.
2. Le dispatcher outbound existe deja et couvre HMAC, retries, timeout, idempotence et journalisation. Il faut l'etendre, pas le remplacer.
3. La strategie UI "modifier les pages existantes avant de creer de nouvelles routes" est juste : elle limite la surcharge cognitive de l'admin.
4. La separation des events metier est saine :
   - `chat_lead.created`
   - `lead.step2_completed`
   - `lead.step1_abandoned`
   - `order.*`
   - `cart.abandoned`

### Corrections necessaires

| Sujet | Probleme detecte | Correction |
|---|---|---|
| Nom d'event order | La doc parle souvent de `order.completed`, mais le code envoie `order.created` dans `from-order.ts`. | Trancher et migrer vers `order.completed` si le contrat externe l'attend; sinon documenter `order.created`. Recommande : `order.completed`, car l'ordre est effectivement finalise cote wizard. |
| `OutboundSource` | Le type autorise seulement `'order' | 'chat-lead' | 'cart-abandon' | 'contact' | 'newsletter'`. | Ne pas ajouter `wizard-step2` inutilement. Utiliser `source: 'chat-lead'` ou etendre explicitement le type avec migration mentale claire. Recommande : ajouter `lead-step2` et `lead-step1-abandon` seulement si l'UI doit filtrer par source; sinon garder `chat-lead` + eventName. |
| `tracking_settings` | Les settings existants n'ont que consentement/attribution. | Ajouter constantes dans `TRACKING_SETTING_KEYS` et etendre l'API PATCH/GET, pas creer une nouvelle table. |
| Liste leads | `listLeads()` charge tous les `chat_lead` puis filtre en memoire. | Acceptable court terme, mais les KPI/filtres parcours doivent passer par requetes SQL agregees pour eviter un backoffice lent. |
| Fire-and-forget | Le chat lead attend actuellement le webhook avant de repondre malgre le commentaire "non bloquant". | Pour le wizard step2, faire fire-and-forget strict; pour chat, garder attente courte seulement si l'UX admin a besoin du statut immediat. |
| Conversation | `snapshot_messages` ne contient que 6 messages tronques a 400 chars. | Le contrat peut accepter cela, mais il faut le documenter comme snapshot court. Si le CRM exige tout l'echange, ajouter un builder qui relit `chat_message` avec limite 50/30 Ko. |
| Anti-doublon step2 | Une simple colonne `step2_webhook_at` ne suffit pas si le dispatch echoue avant stamp. | Idempotency key `lead-step2:<leadId>` doit rester la source de verite; le timestamp est un cache d'affichage/filtre. |
| Retry manuel | Rejouer avec suffixe `:retry-N` peut creer des doublons CRM. | Demander confirmation UI et afficher clairement "nouvelle tentative manuelle". Garder le meme `sourceId`, nouvel `idempotencyKey`, event identique. |

## 3. Decisions d'architecture cible

### Evenements et idempotency

| Trigger | EventName | Source | Idempotency key | Dispatch |
|---|---|---|---|---|
| Chat form submit | `chat_lead.created` | `chat-lead` | `chat-lead:<leadId>` | Immediat, avec conversation |
| Wizard adresse validee | `lead.step2_completed` | `chat-lead` ou `lead-step2` | `lead-step2:<leadId>` | Immediat, fire-and-forget |
| Wizard step1 abandon | `lead.step1_abandoned` | `chat-lead` ou `lead-step1-abandon` | `lead-step1-abandon:<leadId>` | Cron |
| Commande creee/finalisee | `order.completed` | `order` | `order:<orderId>` | Immediat, fire-and-forget |
| Panier abandonne | `cart.abandoned` | `cart-abandon` | `cart-abandon:<leadId>` | Cron existant |

Recommandation : ne pas bloquer la progression utilisateur sur les webhooks wizard. Le webhook est une integration externe; son etat doit etre visible et rejouable en admin.

### Colonnes a ajouter a `chat_lead`

```sql
ALTER TABLE chat_lead
  ADD COLUMN IF NOT EXISTS step2_webhook_at timestamptz,
  ADD COLUMN IF NOT EXISTS step1_abandon_webhook_at timestamptz;

CREATE INDEX IF NOT EXISTS chat_lead_step1_abandon_pending_idx
  ON chat_lead(lead_captured_at)
  WHERE lead_captured_at IS NOT NULL
    AND address_completed_at IS NULL
    AND purchased_at IS NULL
    AND step1_abandon_webhook_at IS NULL
    AND phone_e164 IS NOT NULL;

CREATE INDEX IF NOT EXISTS chat_lead_step2_webhook_idx
  ON chat_lead(step2_webhook_at)
  WHERE step2_webhook_at IS NOT NULL;
```

Ces timestamps ne remplacent pas `outbound_webhook_log`; ils accelerent les filtres et rendent l'etat lisible sur le lead.

### Settings

Ajouter dans `TRACKING_SETTING_KEYS` :

```ts
LEAD_STEP1_ABANDON_ENABLED: 'lead.step1_abandon_enabled',
LEAD_STEP1_ABANDON_TIMEOUT_MINUTES: 'lead.step1_abandon_timeout_minutes',
LEAD_STEP2_WEBHOOK_ENABLED: 'lead.step2_webhook_enabled',
LEAD_WEBHOOK_CONVERSATION_ENABLED: 'lead.webhook_conversation_enabled',
LEAD_WEBHOOK_CONVERSATION_MAX_MESSAGES: 'lead.webhook_conversation_max_messages',
LEAD_WEBHOOK_CONVERSATION_MAX_BYTES: 'lead.webhook_conversation_max_bytes',
```

Defaults recommandes :

| Cle | Default | Validation |
|---|---:|---|
| `lead.step1_abandon_enabled` | `true` | boolean |
| `lead.step1_abandon_timeout_minutes` | `5` | int 1..60 |
| `lead.step2_webhook_enabled` | `true` | boolean |
| `lead.webhook_conversation_enabled` | `true` | boolean |
| `lead.webhook_conversation_max_messages` | `50` | int 1..50 |
| `lead.webhook_conversation_max_bytes` | `30000` | int 1000..50000 |

## 4. Plan d'action ameliore

### M0 - Alignement contrat et baseline

Objectif : eviter de coder sur des hypotheses contradictoires.

Actions :
1. Corriger les docs existantes pour ne plus annoncer `order.completed` si le code reste en `order.created`, ou migrer le code vers `order.completed`.
2. Ajouter une note ADR courte : payload plat, HMAC, events headers, idempotency key stable.
3. Lancer baseline :
   - `pnpm --filter @femiglow/web typecheck`
   - `pnpm --filter @femiglow/web test -- --run src/lib/webhooks/outbound`
   - `pnpm --filter @femiglow/web test:e2e -- checkout-wizard-kit.spec.ts`

Acceptance :
- le contrat webhook dans `README.md` correspond au code.
- aucune regression baseline connue n'est ignoree silencieusement.

### M1 - Schema, settings et types

Actions :
1. Migration Drizzle SQL pour `step2_webhook_at`, `step1_abandon_webhook_at`, indexes et seed settings.
2. Etendre `chatLead` dans `lib/chat/db/schema.ts`.
3. Etendre `TRACKING_SETTING_KEYS`, `GET/PATCH /api/admin/tracking/settings`, schema Zod de PATCH.
4. Ajouter helper serveur `getLeadWebhookSettings()` avec defaults, validation et cache court optionnel.

Acceptance :
- migration idempotente (`IF NOT EXISTS`, seed `ON CONFLICT DO NOTHING`).
- settings lisibles via GET admin et modifiables par PATCH.
- typecheck OK.

### M2 - Payload et builders

Actions :
1. Etendre `outboundPayloadSchema` avec :
   - `source?: string`
   - `conversation?: Array<{ role, name, text, ts }>`
2. Ajouter helpers purs :
   - `snapshotMessagesToConversation()`
   - `chatMessagesToConversation()`
   - `limitConversationPayload(messages, maxMessages, maxBytes)`
3. Modifier `from-chat-lead.ts` pour injecter `conversation`.
4. Ajouter `from-wizard-step2.ts` et `from-wizard-step1-abandon.ts`, ou fonctions nommees dans un module `sources/from-chat-lead.ts` si l'equipe prefere limiter les fichiers.
5. Harmoniser `from-order.ts` :
   - event `order.completed`
   - conversation conditionnelle si lead rattache a une session chat et setting actif.

Acceptance :
- payload invalide -> `skipped` avec log.
- telephone invalide -> pas d'appel reseau.
- conversation tronquee de facon deterministe.
- event names stables et couverts par tests.

### M3 - Triggers runtime

Actions :
1. Dans `PATCH /api/checkout/lead/[leadId]/address` :
   - apres `patchAddress` reussi, lire setting `lead.step2_webhook_enabled`.
   - lancer dispatch fire-and-forget avec idempotency `lead-step2:<leadId>`.
   - stamper `step2_webhook_at` apres resultat final `sent`, `failed`, `disabled` ou `skipped`, ou derivation par log si on veut conserver "attempted at".
2. Creer `lead-step1-abandon-scanner.ts` :
   - filtre : `lead_captured_at < now - timeout`, pas d'adresse, pas d'achat, pas de `step1_abandon_webhook_at`, phone present, consent present.
   - limite par tick : 50 max.
   - stamp apres tentative finale pour eviter le spam.
3. Integrer le scanner dans `/api/cron/tick` avec resultat separe `leadStep1Abandon`.
4. Ajouter logs structurés `outbound.webhook.lead-step2.*` et `outbound.webhook.lead-step1-abandon.*`.

Acceptance :
- un PATCH adresse rejoue via idempotency ne double pas l'appel externe.
- un lead step1 non complete part apres 5 min par defaut.
- si l'admin desactive le scanner, aucun dispatch n'est fait et le cron indique `disabled`.

### M4 - Admin backend read model

Actions :
1. Creer un read model `lib/admin/leads/journey.ts` :
   - `computeLeadJourney(row, latestLogs)` pour ligne.
   - `computeDataPct(row)` pour completion.
   - `computeAbandonedStep(row, settings)` pour etat d'abandon.
2. Ajouter requetes SQL dediees :
   - `listLeadsWithJourney(filters)` : table paginee.
   - `getLeadJourneyDetail(id)`.
   - `listLeadWebhookHistory(leadId)`.
   - `getLeadWebhookKpis(range)`.
   - `getLeadFunnelStats(range)`.
3. Exposer routes admin JSON :
   - `GET /api/admin/leads/[id]/webhook-history`
   - `GET /api/admin/webhooks/outbound/logs`
   - `GET /api/admin/webhooks/outbound/health`
   - `POST /api/admin/webhooks/outbound/retry`
   - `POST /api/admin/webhooks/outbound/test`

Acceptance :
- pagination et filtres sont executes DB-side pour les grands volumes.
- les logs outbound peuvent etre consultes par lead et globalement.
- les endpoints admin utilisent `getAdminSession()` et auditent retry/test/settings.

### M5 - Admin UI ergonomique

Principe : enrichir les surfaces existantes sans transformer l'admin en cockpit surcharge.

#### `/admin/leads`

Ajouter :
- 4 KPI cards compactes : `Step 1`, `Adresse`, `Achat`, `Webhook failed`.
- un mini funnel horizontal sur 3 etapes.
- filtres : `Parcours`, `Webhook`, `Source`.
- colonnes :
  - Identite
  - Contact
  - Parcours
  - Webhook
  - Cree
  - Actions

Wireframe :

```text
Leads
142 prospects

[Step 1 142] [Adresse 93] [Achats 41] [Webhook failed 4]
Step 1  █████████████████████ 100%
Adresse ██████████████        65%
Achat   ███████               29%

[Recherche] [Statut] [Parcours] [Webhook] [Source] [Tri]

Identite       Contact       Parcours          Webhook       Cree       Actions
Sara M.        066...        Lead > Adresse    sent          14/05     Conversation Detail
Youssef A.     061...        Lead abandon      sent abandon  14/05     Detail
Hicham F.      064...        Adresse           failed        13/05     Rejouer Detail
```

#### `/admin/leads/[id]`

Ajouter deux sections avant `Commande` :

```text
Parcours
Lead ✓ 10:01  -> Adresse ✓ 10:03 -> Paiement auto ✓ -> Achat -
Completion donnees : 72%
Champs presents : nom, phone, ville, adresse, note
Champs manquants : email

Livraisons webhook
lead.step2_completed   sent    1x  220ms   10:03
lead.step1_abandoned   -       -   -       non applicable
order.completed        pending -   -       pas encore commande
[Voir historique]
```

#### `/admin/tracking/settings`

Ajouter une section en bas :

```text
Leads -> Webhook outbound
Health : OK / degrade / disabled
Endpoint OUTBOUND_WEBHOOK_URL : configure
Secret HMAC : configure
Success rate 24h : 97%

[x] Envoyer webhook apres adresse
[x] Envoyer automatiquement les leads step1 abandonnes
Delai abandon step1 : [5] minutes
[x] Inclure conversation chat
Max messages : [50]   Max payload conversation : [30000] bytes

[Envoyer payload test] [Voir logs outbound]
```

#### Nouvelle page optionnelle

Creer `/admin/tracking/webhooks/outbound` plutot que `/admin/tracking/webhooks/logs`, pour eviter la confusion avec les logs tracking generiques.

### M6 - Tests et durcissement

Les tests ne doivent pas seulement verifier le "happy path"; ils doivent verrouiller les proprietes d'integration : idempotence, non blocage, visibilité admin et absence de double envoi.

#### Vitest unitaires

Fichiers recommandes :

- `src/lib/webhooks/outbound/payload.test.ts`
  - accepte `source` et `conversation`.
  - refuse conversation > 50 messages.
  - strip les champs vides sans supprimer `conversation`.
- `src/lib/webhooks/outbound/conversation.test.ts`
  - map `assistant` -> `bot`.
  - tronque les textes.
  - respecte max bytes.
- `src/lib/webhooks/outbound/sources/from-chat-lead.test.ts`
  - inclut transcript si snapshot present.
  - n'inclut pas transcript si setting off.
- `src/lib/webhooks/outbound/sources/from-wizard-step2.test.ts`
  - payload adresse complet.
  - idempotency `lead-step2:<id>`.
- `src/lib/webhooks/outbound/lead-step1-abandon-scanner.test.ts`
  - selectionne uniquement les leads eligibles.
  - ignore lead avec adresse ou achat.
  - stamp apres tentative.
- `src/lib/admin/leads/journey.test.ts`
  - calcule `dataPct`.
  - derive etat `step1`, `address`, `purchase`, `abandoned`.

#### Vitest integration + MSW

Utiliser MSW pour intercepter `OUTBOUND_WEBHOOK_URL`.

Scenarios :
1. `PATCH /api/checkout/lead/[id]/address` appelle le webhook une fois.
2. meme PATCH rejoue avec meme idempotency -> pas de second POST externe.
3. endpoint webhook 500 -> retry 3, log failed, reponse wizard reste 200.
4. scanner step1 abandon -> POST payload minimal, stamp.
5. scanner avec setting disabled -> 0 POST.
6. chat lead -> payload contient `conversation`.
7. retry admin -> cree une nouvelle ligne log avec suffixe `:retry-1`.

#### Playwright

Specs a ajouter :

- `e2e/checkout-wizard-webhook.spec.ts`
  - step1 sauvegarde lead.
  - step2 envoie webhook via stub.
  - UI ne se bloque pas si stub repond 500.
- `e2e/admin-leads-journey-webhook.spec.ts`
  - KPI/funnel visibles.
  - filtres `Parcours` et `Webhook` modifient l'URL et la table.
  - badge webhook ouvre drawer.
- `e2e/admin-lead-detail-webhook.spec.ts`
  - timeline parcours.
  - historique webhook.
  - retry demande confirmation puis affiche feedback.
- `e2e/admin-tracking-webhook-settings.spec.ts`
  - toggle settings.
  - input timeout avec validation 1..60.
  - bouton payload test.

#### Tests a11y/UI

- `jest-axe`/Vitest sur composants `JourneyTimeline`, `WebhookStatusBadge`, `LeadWebhookHistoryDrawer`.
- Playwright mobile viewport sur `/admin/leads` : pas de chevauchement, table scrollable dans son conteneur, filtres utilisables.

## 5. Runbook d'implementation

### Avant developpement

1. Creer une branche dediee.
2. Lancer :
   ```bash
   pnpm --filter @femiglow/web typecheck
   pnpm --filter @femiglow/web test -- --run src/lib/webhooks/outbound
   ```
3. Verifier les variables locales :
   ```bash
   OUTBOUND_WEBHOOK_URL=http://127.0.0.1:8787/webhook
   OUTBOUND_WEBHOOK_SECRET=<secret-dev-32-chars-min>
   CRON_SECRET=<secret-dev>
   ```

### Ordre de codage recommande

1. M1 schema/settings.
2. M2 payload/builders avec tests unitaires.
3. M3 triggers runtime avec tests integration.
4. M4 read model admin.
5. M5 UI admin.
6. M6 Playwright et polish.

Ne pas commencer par l'UI : elle depend des read models et sinon elle forcera des contrats API instables.

### Verification locale

Commandes :

```bash
pnpm --filter @femiglow/web typecheck
pnpm --filter @femiglow/web test -- --run \
  src/lib/webhooks/outbound \
  src/lib/admin/leads \
  src/app/api/checkout \
  src/app/api/admin/webhooks
pnpm --filter @femiglow/web test:e2e -- \
  checkout-wizard-webhook.spec.ts \
  admin-leads-journey-webhook.spec.ts \
  admin-tracking-webhook-settings.spec.ts
```

Smoke manuel :

1. Lancer un receveur local qui logge body + headers.
2. Faire un wizard complet jusqu'a l'adresse.
3. Constater un payload `lead.step2_completed` avec nom, phone, city, address.
4. Laisser un lead step1 sans adresse, lancer `/api/cron/tick`, constater `lead.step1_abandoned`.
5. Soumettre un lead chat et verifier `conversation`.
6. Ouvrir `/admin/leads`, controler parcours + webhook.
7. Rejouer un failed depuis le drawer.

### Deploiement

1. Appliquer migrations avec le script safe du repo :
   ```bash
   pnpm --filter @femiglow/web db:migrate-safe:plan
   pnpm --filter @femiglow/web db:migrate-safe
   ```
2. Deployer le code.
3. Verifier `/api/health`.
4. Verifier `/admin/tracking/settings` :
   - URL configuree.
   - secret configure.
   - payload test envoye.
5. Verifier le cron systeme appelle toujours `/api/cron/tick`.

### Monitoring

SQL utiles :

```sql
-- Taux de succes 24h par event
SELECT event_name, status, count(*)
FROM outbound_webhook_log
WHERE created_at > now() - interval '24 hours'
GROUP BY event_name, status
ORDER BY event_name, status;

-- Leads step1 en attente anormale
SELECT id, first_name, phone_e164, lead_captured_at
FROM chat_lead
WHERE lead_captured_at < now() - interval '15 minutes'
  AND address_completed_at IS NULL
  AND purchased_at IS NULL
  AND step1_abandon_webhook_at IS NULL
ORDER BY lead_captured_at ASC
LIMIT 50;

-- Webhooks failed recents
SELECT id, event_name, source_id, attempt_count, response_status, last_error, created_at
FROM outbound_webhook_log
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 50;
```

Alertes recommandees :

- `failed / total > 10%` sur 1h pour `lead.step2_completed`.
- plus de 20 leads step1 en attente au-dela de 2x le timeout.
- `disabled` non nul en production sur 1h.

### Rollback

Rollback applicatif :
1. Desactiver les settings :
   - `lead.step2_webhook_enabled=false`
   - `lead.step1_abandon_enabled=false`
   - `lead.webhook_conversation_enabled=false`
2. Redeployer la version precedente si necessaire.

Rollback DB :
- Ne pas dropper les colonnes en urgence. Elles sont nullable et non destructives.
- Si un index pose probleme, dropper seulement l'index :
  ```sql
  DROP INDEX CONCURRENTLY IF EXISTS chat_lead_step1_abandon_pending_idx;
  ```

Rollback integration externe :
- Retirer temporairement `OUTBOUND_WEBHOOK_URL` force le dispatcher en `disabled`, avec logs.
- Preferer le setting applicatif pour garder les autres events outbound actifs.

## 6. Criteres d'acceptance finaux

1. Un lead wizard step1 est sauvegarde immediatement.
2. Un lead wizard step2 envoie un webhook immediat, idempotent, non bloquant.
3. Un lead step1 abandonne part automatiquement apres le timeout configurable.
4. Un lead chat envoie un webhook immediat avec transcript conforme au contrat.
5. L'admin voit pour chaque lead : etape atteinte, pourcentage de donnees, statut webhook, historique et retry.
6. L'admin configure timeout/toggles/test payload sans quitter `/admin/tracking/settings`.
7. Les logs webhook sont consultables et filtrables.
8. Les tests Vitest couvrent payload/builders/scanners/read models.
9. Les tests MSW couvrent dispatch/retry/idempotence.
10. Les tests Playwright couvrent parcours public + admin + settings.
11. Typecheck, tests cibles et e2e critiques passent.
12. Aucune regression des flows existants `cart.abandoned`, `chat_lead.created`, `order` et `/admin/leads`.
