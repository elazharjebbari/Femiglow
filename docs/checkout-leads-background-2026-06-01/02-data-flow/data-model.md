# 02 — Modèle de données

> Dictionnaire champ-à-champ : [`data-dictionary.csv`](data-dictionary.csv).
> Diagramme ER : [`er-diagram.puml`](er-diagram.puml). Transitions : [`state-transitions.csv`](state-transitions.csv).

## 1. Entités

### 1.1 `chat_lead` (existante — **évolution**)
Row du prospect. `id` passe de **généré serveur** à **fourni client** (`cl_…`).
Colonnes écrites par scope (disjointes — ADR-0006) :

- **lead_create** : `phone`, `first_name`, `consent_version`, `language`, `visitor_id`, `session_id`, `form_id`, `form_mode`, `variant_key`, `source`, `cart_snapshot`, `page`, `referrer`, `utm`, `gclid`, `fbp`, `fbc`, `created_at`.
- **address_update** : `city`, `address_line1`, `address_line2`, `postal_code`, `country`, `notes`, `address_completed_at`.
- **payment_select** : `payment_method`, `payment_selected_at`.
- **order_create** : `purchased_at` (+ row `orders` séparée).
- scanner : `step1_abandon_webhook_at` (inchangé).

Contraintes ajoutées : `CHECK (id ~ '^cl_[0-9a-z]{20,}$')` ; règle d'upsert
« ne pas écraser une valeur par `NULL` » (fill-forward).

### 1.2 `checkout_idempotency` (existante — **réutilisée**)
Clé `(key, scope)`, `request_hash`, `response_json`, `response_status`,
`resource_id`. Aucune évolution nécessaire.

### 1.3 `lead_event_outbox` (**nouvelle** — calquée sur `email_outbox`)
Boîte d'envoi des effets durables.

| Colonne | Type | Note |
|---|---|---|
| `id` | text PK | `lox_…` |
| `type` | text | `purchase_capi` \| `purchase_ga4` \| `order_webhook` \| `cart_abandoned_webhook` \| `lead_capi` |
| `lead_id` | text FK→chat_lead.id | indexé |
| `dedupe_key` | text | event_id / clé métier — `UNIQUE(type, lead_id, dedupe_key)` |
| `payload` | jsonb | données de l'effet (schéma : [`schemas/lead-event-outbox.schema.json`](schemas/lead-event-outbox.schema.json)) |
| `status` | text | `pending` \| `processing` \| `done` \| `dead` |
| `attempts` | int | défaut 0 |
| `max_attempts` | int | défaut 8 |
| `next_attempt_at` | timestamptz | indexé (drain `<= now()`) |
| `last_error` | text null | dernier message d'échec (sans PII) |
| `created_at` / `updated_at` | timestamptz | |

Index : `(status, next_attempt_at)` pour le drain ; `UNIQUE(type, lead_id, dedupe_key)` pour l'idempotence d'effet.

## 2. Invariants de données

- **INV-1** : un `chat_lead.id` est immuable et de la forme `cl_…` (client).
- **INV-2** : un upsert ne **dégrade** jamais une colonne renseignée vers `NULL`.
- **INV-3** : `address_completed_at`/`payment_selected_at` sont monotones (premier non-null gagne, ou last-writer cohérent — cf. règle de merge).
- **INV-4** : pas de row `orders` sans `chat_lead.purchased_at` et inversement (atomicité conversion).
- **INV-5** : pas d'effet exécuté (`done`) sans état métier correspondant committé (outbox transactionnel).
- **INV-6** : `UNIQUE(type, lead_id, dedupe_key)` ⇒ au plus un effet par clé métier.

## 3. Rétention & purge

- `lead_event_outbox` : `done` purgés après 30 j (cron `insights-purge`/dédié) ; `dead` conservés 90 j pour rejeu/audit.
- `checkout_idempotency` : politique existante inchangée.
- PII de `chat_lead` : politique RGPD existante (non modifiée par OWBS).

## 4. Migration

Migration **Drizzle** additive (`drizzle-kit generate` → SQL dans
`drizzle/migrations/`) : `CREATE TABLE lead_event_outbox` + index + `CHECK`
sur `chat_lead.id` (ajouté `NOT VALID` puis `VALIDATE` pour éviter le lock long).
**Aucune** réécriture de données existantes. Réversible (`DROP TABLE`, flag OFF).
Tests DB via `pglite` (cf. `*.pglite.integration.test.ts`).
