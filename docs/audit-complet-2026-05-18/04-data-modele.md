# 04 — Data, modèle & flux

> **Vue d'ensemble** : 92 tables sur 3 fichiers de schéma Drizzle, 66 migrations versionnées, validateur strict pre-commit. Modèle riche et mature (idempotence webhooks, audit trail, double opt-in email, encryption des secrets). Trois faiblesses : PII en clair, indexes manquants sur `user_event`, soft-delete absent sur leads/orders.

---

## 1. Topologie du schéma

3 fichiers de schéma + 66 migrations :

| Fichier | Tables | Domaine |
|---|---|---|
| `src/lib/db/schema.ts` | 75 | noyau métier (auth, leads, orders, webhooks, media, audit, chat hors LLM, tracking, ...) |
| `src/lib/db/schema-emails.ts` | 17 | email transactional + Listmonk (campaigns, audiences, snapshots, subscribers) |
| `src/lib/chat/db/schema.ts` | 11 | sessions chat, messages, events, FAQs, instructions, embeddings |
| `src/lib/db/schema-tracking-plan.ts` | (existe, à compléter) | plans tracking versionnés |

Migrations : `drizzle/migrations/0000_initial.sql` → `0056_inline_contact_webhook_events.sql`.

---

## 2. Tables principales

### 2.1 Auth

```sql
admin_users (
  id TEXT PK,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT (Argon2id),
  created_at TIMESTAMPTZ
)
```

### 2.2 Leads (source de vérité legacy)

```sql
leads (
  id TEXT PK,
  email TEXT NOT NULL,
  phone TEXT,
  name TEXT,
  status leadStatus ENUM (new|contacted|qualified|converted|lost|archived),
  source TEXT,
  consentMarketing BOOLEAN DEFAULT false,
  created_at, updated_at TIMESTAMPTZ
)
-- Indexes : email, status, created_at
```

**Notes** :
- Pas de UNIQUE sur `email` (choix métier : plusieurs leads possibles par email).
- Pas de soft-delete (cf. §7 RGPD).
- Encryption au repos : ❌ (cf. doc `05-securite-conformite.md`).

### 2.3 Chat Lead (funnel wizard / chat)

```sql
chat_lead (
  id TEXT PK,
  session_id TEXT UNIQUE,  -- migration 0054 : INDEX UNIQUE ajouté + atomic upsert
  email TEXT,
  phone TEXT (E.164 quand détecté),
  source chatLeadSource ENUM (wizard_step1|wizard_step2|inline_contact|chat_form),
  leadCapturedAt TIMESTAMPTZ,  -- NULL pour inline_contact (cf. audit 0516)
  addressCompletedAt TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

Migration 0054 (`fix(leads): UNIQUE index + atomic upsert` — commit `01601d4`) :
- Déduplication préalable (garde la plus récente sur conflit `session_id`).
- Ajout `CREATE UNIQUE INDEX chat_lead_session_unique_idx ON chat_lead (session_id)`.
- Requête atomique : `INSERT ... ON CONFLICT DO NOTHING` + `SELECT WHERE session_id = $1` fallback.
- Tests : `lead-dedup.test.ts` (7 scénarios).

### 2.4 Orders & Order Items

```sql
orders (
  id TEXT PK,
  lead_id TEXT FK→leads,
  chat_lead_id TEXT FK→chat_lead (optionnel — wizard uniquement),
  total_cents INTEGER, currency TEXT,
  form_id TEXT,
  form_mode formMode ENUM (wizard_embed|wizard_cart|legacy_cart),
  variant_key variantKey ENUM (A|B|control),  -- A/B test tracking
  created_at TIMESTAMPTZ
)
-- Indexes : lead_id, chat_lead_id, (form_id, form_mode, created_at)

order_items (
  id TEXT PK,
  order_id TEXT FK→orders ON CASCADE,
  sku TEXT, quantity INT, unit_price_cents INT
)
```

### 2.5 Webhooks — architecture double

#### Webhook endpoints (multi-tenant admin)
```sql
webhook_endpoints (
  id TEXT PK,
  url TEXT NOT NULL,
  events JSONB,  -- array[string]
  encryptedSecret TEXT,  -- AES-256-GCM dérivé scrypt(WEBHOOK_SECRET_KEY, salt)
  active BOOLEAN,
  created_at, updated_at, deletedAt TIMESTAMPTZ
)
```

#### Webhook deliveries (inbound webhooks tiers)
```sql
webhook_deliveries (
  id TEXT PK,
  endpoint_id TEXT FK→webhook_endpoints ON CASCADE,
  event TEXT, payload JSONB,
  idempotencyKey TEXT,
  status deliveryStatus ENUM (pending|in_progress|succeeded|failed|permanent),
  attemptCount INT,
  nextAttemptAt TIMESTAMPTZ,
  responseStatus INT, responseBody TEXT, latencyMs INT
)
-- Indexes : status, nextAttemptAt
-- UNIQUE : (endpoint_id, idempotency_key)
```

#### Outbound webhook log (1 destination URL via env)
```sql
outbound_webhook_log (
  id TEXT PK,
  source TEXT, sourceId TEXT,
  idempotencyKey TEXT UNIQUE,
  eventName TEXT,
  payload JSONB,
  status TEXT, attemptCount INT, lastError TEXT
)
-- Indexes : idempotencyKey, (source, sourceId), (status, created_at)
```

### 2.6 User event (event log unifié)

```sql
user_event (
  id BIGSERIAL PK,
  email TEXT NOT NULL,
  event_name TEXT NOT NULL,
  ts TIMESTAMPTZ,
  properties JSONB DEFAULT {},
  sessionId TEXT,
  source eventSource ENUM (web|server|email|admin|import),
  lead_id TEXT FK→leads ON DELETE SET NULL
)
-- Indexes : lead_id seulement (insuffisant)
```

🔴 **Indexes manquants critiques** : `(email, ts DESC)`, `(event_name, ts DESC)`, GIN sur `properties`. Sans eux, les requêtes analytics (admin insights) tapent en seq scan.

### 2.7 Audit events

```sql
audit_events (
  id TEXT PK,
  action TEXT NOT NULL,
  actor_id TEXT,  -- admin_user.id
  resource_type TEXT,
  resource_id TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ
)
-- Indexes : created_at, action
```

### 2.8 Médias

75 colonnes au total sur `media` (gros) + tables associées :
- `media` : soft-delete (`deletedAt`), phash dedup.
- `media_variants` : formats (avif/webp/jpeg/png/mp4) × breakpoints (xs–2xl), UNIQUE partiel `(media_id, format, breakpoint)`.
- `media_tags`, `media_usages`, `media_jobs` : taxonomies / queue / usage tracking.

### 2.9 Emails (Stalwart + Listmonk)

`schema-emails.ts` (17 tables) :
- `email_subscriber_link` : double opt-in (`pending|enabled|disabled`, `consent_at`, `double_optin_confirmed_at`, `consent_source`).
- `email_campaigns`, `email_audiences`, `email_snapshots` : Listmonk sync.
- `email_transactional` : logs envois.

### 2.10 Chat (LLM)

`lib/chat/db/schema.ts` (11 tables) :
- `chat_session`, `chat_message`, `chat_event`, `chat_feedback`.
- `chat_faq` (avec embeddings 1536-dim pgvector), `chat_instruction`, `chat_provider`, `chat_billing_period`, ...

---

## 3. Migrations Drizzle (qualité)

✅ **66 migrations** versionnées, cohérence garantie par :
- `_validate-migrations.mjs` (hash-based, journal `meta/_journal.json`, détection de "fantômes").
- `_check-migrations.ts` (pre-commit).
- Marker `@no-transaction:true` respecté pour `CREATE INDEX CONCURRENTLY` (ex. migration 0041).
- Validation `drizzle-kit generate` stricte.

🟡 **66 migrations = complexité croissante**. Recommandation : audit consolidation tous les 50 numéros (squash optionnel ou simple revue).

---

## 4. Qualité du modèle

### 4.1 Indexes — adéquation

| Évaluation | Détail |
|---|---|
| FK indexés | ✅ Tous les FK majeurs |
| Colonnes de filtrage (`status`, `created_at`, `email`) | ✅ |
| Index composites pertinents | ✅ (`(form_id, form_mode, created_at)` sur orders) |
| UNIQUE webhook dédup | ✅ |
| GIN JSONB | ❌ Absent sur `user_event.properties` |
| `(email, ts DESC)` user_event | ❌ Manquant |

### 4.2 Identifiants

Surrogate IDs (text UUID-like) partout. Bon choix pour :
- Sharding futur.
- Obscurcissement (pas d'incrémentation visible).
- Multi-tenant éventuel.

Coût stockage ≈ 4× vs `bigserial`, négligeable < 1 M lignes/table.

### 4.3 Timestamps

`timestamp(... withTimezone: true)` partout → TIMESTAMPTZ. UTC interne, conversion locale côté UI.

### 4.4 Soft delete

| Table | Soft delete |
|---|---|
| `webhook_endpoints` | ✅ |
| `media` | ✅ |
| `media_variants` | ✅ |
| `leads` | ❌ |
| `orders` | ❌ |
| `chat_lead` | ❌ |
| `user_event` | ❌ (intentionnel — audit trail) |

🟠 Pour le RGPD (droit à l'oubli), il faut soit soft-delete + purge cron, soit hard-delete + pseudonymisation. Aujourd'hui ni l'un ni l'autre n'est implémenté.

### 4.5 UNIQUE constraints

| Table | UNIQUE |
|---|---|
| `admin_users.email` | ✅ |
| `chat_lead.session_id` | ✅ (migration 0054) |
| `lead_tag(lead_id, tag)` | ✅ partiel conditionnel |
| `media.slug` | ✅ partiel `WHERE deletedAt IS NULL` |
| `media_variants(media_id, format, breakpoint)` | ✅ partiel |
| `webhook_deliveries(endpoint_id, idempotency_key)` | ✅ |
| `outbound_webhook_log.idempotencyKey` | ✅ |

### 4.6 Types

| Domaine | Type choisi | OK |
|---|---|---|
| ID, email, phone | TEXT | ✅ |
| Montants | INTEGER (cents) | ✅ (jamais float) |
| Payloads variables | JSONB | ✅ |
| Énums | PG ENUM | ✅ (type-safe DB-side) |
| Timestamps | TIMESTAMPTZ | ✅ |
| Tailles fichiers | BIGINT | ✅ |

✅ Modèle sain, choix de types soignés.

---

## 5. Flux de données critiques

### 5.1 Lead funnel (acquisition → conversion)

```
Utilisateur visite /kit
  │
  ├─ Option 1 : Wizard Chat (CHA-230, "inline-contact")
  │     → detectInlineContact() → chat_lead.create(source='inline_contact')
  │     → leadCapturedAt = NULL  ⚠ (bug initial, fix commit 4855c91 dispatch webhook)
  │
  ├─ Option 2 : Wizard Form multi-step
  │     → step1 : email + phone → chat_lead.create(source='wizard_step1')
  │             → leadCapturedAt = now()
  │             → webhook dispatch 'lead.step1_completed'
  │     → step2 : adresse → chat_lead.update + addressCompletedAt
  │             → webhook dispatch 'lead.step2_completed'
  │     → order.create(leadId, chatLeadId)
  │             → webhook dispatch 'order.created'
  │
  └─ Option 3 : Cart legacy
        → order.create(leadId) direct
        → webhook dispatch 'order.created'
```

**Bug critique audit 0516** : 5/6 sources webhook étaient en `disabled` (faute de `OUTBOUND_WEBHOOK_URL` configuré en prod). Plan d'action `docs/plan-action-webhook-leads-2026-05-16.md` (6 phases) + commits `4855c91`, `8c06eb9`. Statut : à vérifier en prod.

### 5.2 Webhooks entrants

| Source | Route | Auth | Idempotency |
|---|---|---|---|
| Stripe | `/api/stripe/webhook` | `Stripe-Signature` HMAC | `idempotencyKey` table |
| Stalwart | `/api/mail/webhook/stalwart` | header `X-FG-Webhook-Token` (`timingSafeEqual`) | sur `idempotencyKey` |
| Listmonk | `/api/mail/webhook/listmonk` | Bearer HMAC SHA-256 | sur `idempotencyKey` |

### 5.3 Webhooks sortants

```
Sources : lead.step1_abandoned, lead.step2_completed, chat_lead.created,
          cart.abandoned, order.created, contact.submitted

Destinations :
  1. webhook_endpoints (admin multi-dest, secret en clair côté DB chiffré AES-GCM)
  2. OUTBOUND_WEBHOOK_URL (env var, 1 dest unique, secret en env)

Pattern outbound :
  → idempotencyKey = hash(source, sourceId, event)
  → outbound_webhook_log.insert(status='pending')
  → cron retry every 1 min : fetch pending, POST avec HMAC, update
  → success → status='succeeded'
  → failure → status='failed', attemptCount++, schedule nextAttemptAt (exp backoff)
  → max 24 retries
```

### 5.4 Tracking events

`user_event` table unifiée, source enum (`web|server|email|admin|import`). Pas d'envoi DB → CAPI direct ; les events transitent par `/api/track` (front) ou par GTM avant CAPI.

---

## 6. Forces du modèle

1. **Drizzle ORM type-safe** : pas de raw SQL vulnérable (sauf 1 cas `sql.raw()` sur view name hardcoded — safe).
2. **Migrations strictes** : validator hash-based, journal sync, marker `@no-transaction`.
3. **Idempotence DB-side** sur webhooks (deliveries + outbound log).
4. **Encryption secrets** : `webhook_endpoints.encryptedSecret` AES-256-GCM via scrypt.
5. **Audit trail systématique** (`audit_events`).
6. **Types sains** : INT cents (pas de float), TIMESTAMPTZ, PG ENUMs.
7. **Séparation schémas** : `schema.ts` vs `schema-emails.ts` vs `chat/db/schema.ts` — découplage propre.
8. **Soft delete sur media** + tag UNIQUE partiel `WHERE deletedAt IS NULL` (excellent).
9. **Tests dédup** récents (`lead-dedup.test.ts`) couvrent les cas tordus.

---

## 7. Faiblesses du modèle

| # | Constat | Sévérité |
|---|---|---|
| F1 | **PII en clair** : `leads.email/phone/name`, `chat_lead.email/phone`, adresses. | 🔴 P0 |
| F2 | **Indexes `user_event` insuffisants** : seulement `lead_id`. Requêtes analytics par email/event coûteuses. | 🟠 P1 |
| F3 | **Soft delete absent sur `leads`, `orders`, `chat_lead`** → droit à l'oubli RGPD difficile. | 🟠 P1 |
| F4 | **Pas de retention policy documentée** sur les leads inactifs, sur `user_event` (illimité). | 🟡 P2 |
| F5 | **`outbound_webhook_log` mono-destination** : 1 URL fixe en env. Si on veut un 2ᵉ consommateur, il faut passer par `webhook_endpoints`. | 🟢 P3 |
| F6 | **Pas de FK sur `user_event.email`** (recherche par email lente, et pas de cohérence référentielle vers `leads`). | 🟡 P2 |
| F7 | **`schema-tracking-plan.ts`** : structure à clarifier (referencé mais non audité ici). | 🟡 P2 |
| F8 | **Migrations cumulatives 66** : pas de doc consolidée des choix DB historiques. Manque un ERD à jour. | 🟡 P2 |

---

## 8. Recommandations

### P0
1. **Chiffrer PII** (`leads.phone`, `leads.email`, adresses dans `chat_lead`) avec AES-256-GCM. Réutiliser `lib/crypto/encryption.ts` (déjà utilisé pour `webhook_endpoints.encryptedSecret`). Prévoir migration de backfill + dual-read pendant la transition.
   **Effort** : 2–3 jours.

### P1
2. **Ajouter indexes `user_event`** :
   ```sql
   CREATE INDEX CONCURRENTLY user_event_email_ts_idx ON user_event (email, ts DESC);
   CREATE INDEX CONCURRENTLY user_event_event_ts_idx ON user_event (event_name, ts DESC);
   CREATE INDEX CONCURRENTLY user_event_props_gin_idx ON user_event USING GIN (properties);
   ```
   Migration `@no-transaction:true` (pour CONCURRENTLY).
   **Effort** : 0,5 jour.

3. **Soft delete + droit à l'oubli** :
   - Ajouter `deletedAt TIMESTAMPTZ` sur `leads`, `orders`, `chat_lead`.
   - Index partiel sur `(deletedAt IS NULL)`.
   - Endpoint `/api/admin/data-subject/delete` : cascade delete physique + pseudonymisation des FK enfants.
   **Effort** : 2–3 jours.

4. **Documenter retention policy** dans `docs/legal/retention-policy.md` :
   - Leads inactifs > 3 ans → anonymisation.
   - `user_event` > 13 mois → purge ou archivage.
   - Email bounces durs → hard delete immédiat.

### P2
5. **ERD à jour** : générer un Mermaid ER depuis Drizzle (`drizzle-kit introspect` ou script maison). Stocker `docs/data/erd.md`.
   **Effort** : 0,5 jour.

6. **FK `user_event.lead_id`** est déjà là, mais pas `user_event.email_idx`. Évaluer si on bascule sur `lead_id` only (refactor JOIN) ou si on garde la dénormalisation.

7. **Test de restauration Neon PITR** : dry-run mensuel sur staging.

---

## 9. Scorecard data

| Critère | Score | Commentaire |
|---|---|---|
| Structure des tables | 9 / 10 | mature, ENUMs typés, FK consistants |
| Indexes | 7 / 10 | manque sur `user_event` |
| Migrations | 9 / 10 | validator strict, journal |
| Idempotence DB | 10 / 10 | UNIQUE webhook, atomic upsert chat_lead |
| Chiffrement | 5 / 10 | secrets OK, PII non |
| Soft delete | 5 / 10 | partiel (media seulement) |
| RGPD ready | 5 / 10 | consent OK, droit oubli non |
| Documentation ERD | 4 / 10 | manque diagramme |
| **Global** | **6,7 / 10** | bon socle, gaps RGPD |
