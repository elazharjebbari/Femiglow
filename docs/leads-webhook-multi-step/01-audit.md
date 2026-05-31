# 1. Audit — état actuel du système

> Note de consolidation : ce fichier reprend l'audit initial de Claude. Les corrections vérifiées contre le code actuel, notamment le drift `order.created` vs `order.completed`, sont tranchées dans [`07-audit-critique-plan-runbook.md`](./07-audit-critique-plan-runbook.md).

Snapshot daté du **2026-05-15**. Tous les chemins sont relatifs à `apps/web/src/`.

## 1.1 Capture du lead (wizard checkout multi-step)

### Composants front

| Fichier | Rôle |
|---|---|
| `components/commerce/CheckoutFlow.tsx` (1-150) | Orchestrateur 3 steps (Infos / Adresse / Confirmation), state RHF + Zustand, auto-save draft localStorage (debounce 400ms) |
| `components/commerce/steps/InfoStep.tsx` (1-100) | Step 1 — `firstName`, `phone`, consent. Tracking `form_start` + `checkout_intent` |
| `components/commerce/steps/AddressStep.tsx` | Step 2 — `city`, `addressLine1`, `addressLine2`, `postalCode`, `notes` |
| `components/commerce/steps/PaymentStep.tsx` | Step 3 — mode paiement (CHA-231 : devenu optionnel côté UI, appliqué silently côté serveur) |

### Routes API

| Méthode + Route | Effet DB | Idempotency |
|---|---|---|
| `POST /api/checkout/lead` | Insert `chat_lead` (lead_captured_at=now, last_touched_step='lead') | `Idempotency-Key` + scope `lead_create` |
| `PATCH /api/checkout/lead/[leadId]/address` | Update `chat_lead.shipping_*`, `address_completed_at=now` | scope `address_update` |
| `POST /api/checkout/order` | Insert `orders` + `order_items`, update `chat_lead.purchased_at=now`. **Auto-applique** `paymentSelected_at` si null. **Dispatch webhook** order.completed (fire-and-forget) | scope `order_create` |

### Persistance — table `chat_lead`

Table polyvalente (chat ET wizard). Colonnes pertinentes pour le wizard :

```
id                       text PK
session_id               text FK chat_session
first_name               text
last_name                text  (opt step 4)
email                    text  (opt step 4)
phone_e164               text  (normalisé E.164)
phone_raw                text
consent_version          text, consent_at timestamp
shipping_*               (city, address_line1/2, postal_code, country, notes)
preferred_payment_method enum (cod | bank_transfer | card)
source                   (chat_widget | wizard_kit | wizard_cart | …)
form_id, form_mode, variant_key
cart_snapshot            jsonb {items[], totalCents, currency}
cart_total_cents, cart_currency
gclid, fbp, fbc          (attribution IDs)
last_touched_step        (cart_review | lead | address | payment | thank_you)
lead_captured_at         timestamp ← step 1 OK
address_completed_at     timestamp ← step 2 OK
payment_selected_at      timestamp ← step 3 OK
purchased_at             timestamp ← order créé
webhook_status, webhook_attempts, webhook_last_error, webhook_sent_at
abandon_webhook_at       timestamp ← anti-doublon abandon (cart-abandon scanner)
snapshot_messages        jsonb Array<{role, content, at}>  ← transcript chat
trigger_reason           text   ← d'où vient le lead chat
```

Source: `lib/chat/db/schema.ts` (454-591), migration `drizzle/migrations/0016_chat_lead_funnel_extensions.sql`.

## 1.2 Webhook outbound (unifié, CHA-260)

### Dispatcher central

`lib/webhooks/outbound/dispatcher.ts` (1-369)

- Lookup endpoint : `OUTBOUND_WEBHOOK_URL` + `OUTBOUND_WEBHOOK_SECRET` (env), fallback `CHAT_LEAD_WEBHOOK_*`
- Validation Zod stricte du payload (`lib/webhooks/outbound/payload.ts`)
- Idempotency court-circuit : `outbound_webhook_log` UNIQUE INDEX `(idempotency_key)`, skip si `status='sent'`
- Retry : 3 tentatives, backoff `[1s, 3s, 9s]`, timeout 8s/tentative
- Headers signés : `x-femiglow-signature: sha256=<HMAC-SHA-256(body, secret)>`, `x-femiglow-event`, `x-femiglow-source`, `idempotency-key`
- Log persistance : `outbound_webhook_log` avec status (`pending|sent|failed|skipped|disabled`), `attempt_count`, `response_status`, `latency_ms`, `last_error`, `sent_at`

### Format payload actuel

`lib/webhooks/outbound/payload.ts` (22-109) — schéma Zod :

```ts
{
  id: string,             // requis
  ref?: string,
  full_name: string,      // requis
  phone: string,          // requis, max 40
  address?, city?, country?, email?,
  total_price?: number,
  currency: string,       // default 'MAD'
  quantity: number,       // default 1
  product_name?, product_variant?, product_sku?,
  note?, source_channel?, ip?
}
```

**Normalisation téléphone** (`payload.ts` 80-88) : pour MA/FR/BE/CH/DZ → `0<national>` (trunk prefix), sinon E.164 brut.

### Builders par source

| Builder | Fichier | Trigger |
|---|---|---|
| `order` | `lib/webhooks/outbound/sources/from-order.ts` (1-160) | `/api/checkout/order` après order créé. Event `order.completed`. |
| `chat-lead` | `lib/webhooks/outbound/sources/from-chat-lead.ts` (1-108) | `/api/chat/lead/contact` après chat_lead créé. Event `chat_lead.created`. |
| `cart-abandon` | `lib/webhooks/outbound/cart-abandon-scanner.ts` | Cron tick (`>30min` sans purchase). Event `cart.abandoned`. |

### Table `outbound_webhook_log`

```
id, source (order|chat-lead|cart-abandon|contact|newsletter),
source_id, idempotency_key (UNIQUE), event_name,
payload (jsonb), status, attempt_count, last_error,
response_status, latency_ms, sent_at, created_at
```

Source: `lib/db/schema.ts` (242-265), migration 0026.

## 1.3 Chat IA → lead → webhook

### Tables chat

| Table | Rôle |
|---|---|
| `chat_session` | Session visiteur (cs_xxx). FK vers instruction_version. converted_order_id si convertie. |
| `chat_message` | Messages user/assistant/system. `content`, `role`, status, tokens, latency. |
| `chat_conversation_event` | KPI log append-only. Types incluent `chat_lead_form_offered`, `_view`, `_focus`, `_submit`, `_dismiss`, `_webhook_sent`, `_webhook_failed`. |
| `chat_lead` | Lead in-widget. Snapshot 6 derniers messages dans `snapshot_messages` jsonb. |

Source: `lib/chat/db/schema.ts` (145-591).

### Flow capture chat

1. Assistant détecte intent (purchase-intent, frustration, out-of-knowledge, …) → SSE signal vers front
2. Front affiche `LeadFormBubble.tsx`, user soumet `POST /api/chat/lead/contact`
3. Route :
   - Validation Zod (`firstName`, `phoneRaw`, `consentVersion`, honeypot)
   - Rate-limit IP + session
   - Parse phone E.164 (`lib/phone/normalize.ts`)
   - Snapshot 6 derniers `chat_message` → `chat_lead.snapshot_messages`
   - Insert `chat_lead` avec `trigger_reason`, `intent_at_capture`
   - Append `chat_conversation_event` type `chat_lead_form_submit`
   - **Dispatch webhook fire-and-forget** via `dispatchLeadWebhook(lead)`
4. Builder `from-chat-lead.ts` compose payload (NB: ne met PAS la conversation dans le payload — `note` seulement enrichie avec trigger_reason + intent)

### CHA-225 — lead auto-créé inline

Quand user tape un numéro de tél dans le chat sans soumettre le form :
- Regex détection → lead créé avec `trigger_reason='inline-contact'`
- Quand il soumet ensuite, route détecte le lead existant + appelle `leadRepo.upgrade()`
- Event `chat_lead_form_upgrade` append

## 1.4 GAPS vs spec utilisateur

| Besoin spec | État actuel | Gap |
|---|---|---|
| Step 1 → save immédiat | ✅ `POST /api/checkout/lead` insert chat_lead | OK |
| Step 2 → enrichissement | ✅ `PATCH /api/checkout/lead/[id]/address` | OK |
| Step 2 → webhook immédiat | ⚠️ Aujourd'hui webhook fire seulement à `/order` (purchase). Pas après step 2 seul. | **À ajouter** : dispatch webhook event `lead.step2_completed` après PATCH address réussi |
| Timeout step 1 → step 2 (5min default, configurable) | ❌ Pas de cron lead-abandon spécifique (cart-abandon-scanner = 30min, scope différent) | **À créer** : `lead-step1-abandon-scanner.ts` + setting `lead.step1_abandon_timeout_minutes` |
| Setting modifiable côté admin | ❌ Pas d'UI | **À créer** : ligne `tracking_settings` + composant UI |
| Chat lead → submit immédiat | ✅ Déjà le cas | OK |
| Chat lead → payload contient `conversation` | ❌ Schéma payload Zod n'a pas le champ. `snapshot_messages` stocké mais pas transmis. | **À ajouter** : champ `conversation` au schéma, mapper `snapshot_messages` |
| Phone normalisation +212 | ✅ E.164 + trunk prefix MA | OK |
| Idempotency / retry / signature | ✅ Tous présents (dispatcher unifié) | OK |
| Lien lead ↔ chat session ↔ email | ✅ FK `chat_lead.session_id`, colonne `email` existe | OK |

**Conclusion** : 80% en place. 4 chantiers à livrer (cf. `02-design.md` et `03-implementation.md`).
