# Outbound Webhook — Runbook

**Statut** : runbook actif (exécution en cours).
**Référence ticket** : CHA-260 (alignement contrat n8n / CRM).
**Cible** : payload **plat** unique pour tous les triggers (`order.completed`, `cart.abandoned`, `lead.chat`, `lead.contact`, `lead.newsletter`), envoi côté serveur avec HMAC-SHA-256, retries, idempotency-key, garde-fou téléphone.

---

## 1. Contrat — payload outbound

Le body POSTé est **plat** (pas de wrapping `{event, payload}`). Les métadonnées d'événement vont en headers.

```jsonc
{
  "id": "order-2026-0042",       // requis — sert aussi d'idempotency-key
  "ref": "#0042",                 // optionnel — référence externe affichée
  "full_name": "Youssef Amrani",  // requis — non-vide
  "phone": "0661234567",          // requis — format national affichage MA après normalisation E.164
  "address": "12 Rue Al Houda",   // optionnel
  "city": "Marrakech",            // optionnel
  "country": "Maroc",             // optionnel (libellé humain — pas ISO)
  "email": "y@example.com",       // optionnel — validé email si fourni
  "total_price": 399.0,           // optionnel — number MAD/EUR (unité, pas centimes)
  "currency": "MAD",              // défaut "MAD"
  "quantity": 1,                  // défaut 1
  "product_name": "Pack FemiGlow",
  "product_variant": "Pack complet",
  "product_sku": "FEMI-KIT-100",
  "note": "Livraison urgente",
  "source_channel": "chat",       // chat | contact-form | newsletter | cart-abandon | order
  "ip": "197.230.1.5"
}
```

### Headers HTTP

| Header | Exemple | Rôle |
|---|---|---|
| `content-type` | `application/json` | — |
| `x-femiglow-event` | `order.completed` | nom logique de l'événement |
| `x-femiglow-source` | `order` / `chat-lead` / … | trigger interne |
| `x-femiglow-signature` | `sha256=<hex>` | HMAC-SHA-256 du body brut avec `OUTBOUND_WEBHOOK_SECRET` |
| `idempotency-key` | `order:ord_xxxxxx` | identique au `payload.id` (les receveurs n8n dédupliquent par cet header) |
| `user-agent` | `FemiGlow-Webhook/1.0` | — |

### Règles de validité strictes (Zod)

- `id` : string non-vide, max 200, slug-like (`^[a-zA-Z0-9_:.-]+$`).
- `full_name` : string non-vide, trim, max 200.
- `phone` : non-vide. Normalisation via `parsePhone()` (Morocco-first). Si l'entrée est invalide → **le webhook n'est pas envoyé**, status `skipped: invalid-phone`.
- `email` : email valide si fourni, sinon omis.
- `total_price` : number ≥ 0 (unité monétaire, pas centimes).
- `currency` : ISO 4217 string 3 lettres, défaut `MAD`.
- `quantity` : int ≥ 1, défaut 1.
- Champs optionnels : omis si vides/null (pas envoyés comme `null`).

### Garde-fou téléphone

`parsePhone(raw, 'MA')` est l'unique source de vérité. Si elle renvoie `null` :
- **Order completed** : impossible (le wizard exige le téléphone) — log alerte si on rencontre ce cas.
- **Cart abandoned** : skip silencieux (intentionnel — c'est la règle utilisateur).
- **Chat lead** : impossible (validation Zod en amont).
- **Contact form** : skip si phone absent ou invalide (cas légitime — type=question sans phone).
- **Newsletter** : skip systématique (newsletter ne capture pas de phone).

---

## 2. Variables d'environnement

```bash
# Endpoint outbound unique (n8n / Zapier / CRM).
OUTBOUND_WEBHOOK_URL=https://n8n.example.com/webhook/femiglow
OUTBOUND_WEBHOOK_SECRET=please-rotate-min-32-chars-XXXXXXXXXXXXXXXX

# Fallback (rétrocompat CHA-206). Si OUTBOUND_WEBHOOK_URL absent, on retombe ici.
CHAT_LEAD_WEBHOOK_URL=...
CHAT_LEAD_WEBHOOK_SECRET=...
```

**Comportement** :
- `OUTBOUND_WEBHOOK_URL` absent ET `CHAT_LEAD_WEBHOOK_URL` absent → tous les triggers retournent `disabled`, aucun fetch émis.
- `OUTBOUND_WEBHOOK_URL` présent → utilisé pour tous les triggers (priorité).
- Seul `CHAT_LEAD_WEBHOOK_URL` présent → utilisé (fallback rétrocompat).

---

## 3. Triggers par source

| Source | Trigger interne | Fichier hook | Idempotency-key |
|---|---|---|---|
| Order completed | `orderRepo.createOrder()` succès | `src/app/api/checkout/order/route.ts` (post-create) | `order:{orderId}` |
| Chat lead | `POST /api/chat/lead/contact` succès | `src/lib/chat/services/lead-webhook.ts` (refit) | `chat-lead:{leadId}` |
| Contact form | `POST /api/contact` succès (phone valide) | `src/app/api/contact/route.ts` | `contact:{submissionId}` |
| Newsletter | `POST /api/newsletter` succès (skip — pas de phone) | `src/app/api/newsletter/route.ts` | — |
| Cart abandoned | Cron tick `POST /api/cron/tick` | `src/lib/webhooks/outbound/cart-abandon-scanner.ts` | `cart-abandon:{leadId}` |

### Cart abandoned — règles d'éligibilité

Un `chat_lead` est éligible au webhook `cart.abandoned` si :
1. `phone_e164 IS NOT NULL` ET `parsePhone` valide ;
2. `purchased_at IS NULL` ;
3. `abandon_webhook_at IS NULL` (anti-doublon) ;
4. `created_at < NOW() - INTERVAL '30 minutes'` (idle threshold) ;
5. `created_at > NOW() - INTERVAL '7 days'` (fenêtre de pertinence).

Après envoi (succès ou échec final), `abandon_webhook_at = NOW()` est posé. Pas de retry tant que la fenêtre n'est pas resettée.

---

## 4. Architecture interne

```
src/lib/webhooks/outbound/
├── payload.ts             # Zod schema + type OutboundPayload + sanitize/strip
├── dispatcher.ts          # buildAndSend(): valide → sign → POST → retry → log
├── sources/
│   ├── from-order.ts      # buildPayloadFromOrder(order, lead, ip?)
│   ├── from-chat-lead.ts  # buildPayloadFromChatLead(lead, ip?)
│   ├── from-contact.ts    # buildPayloadFromContact(submission, ip?)
│   ├── from-newsletter.ts # buildPayloadFromNewsletter(sub) — vérifie phone present
│   └── from-cart-abandon.ts # buildPayloadFromCartAbandon(lead, cartSnapshot?)
├── cart-abandon-scanner.ts # scan chat_lead pour cart abandonnés (cron tick)
└── log-queries.ts         # outbound_webhook_log CRUD
```

### Tables DB ajoutées (migration `0026_outbound_webhook_log.sql`)

```sql
CREATE TABLE outbound_webhook_log (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,              -- 'order' | 'chat-lead' | 'cart-abandon' | 'contact' | 'newsletter'
  source_id TEXT NOT NULL,           -- id de l'entité d'origine (orderId, leadId, …)
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL,              -- 'pending' | 'sent' | 'failed' | 'skipped' | 'disabled'
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  response_status INTEGER,
  latency_ms INTEGER,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX outbound_webhook_log_idem_idx ON outbound_webhook_log(idempotency_key);
CREATE INDEX outbound_webhook_log_source_idx ON outbound_webhook_log(source, source_id);
CREATE INDEX outbound_webhook_log_status_idx ON outbound_webhook_log(status, created_at DESC);

ALTER TABLE chat_lead ADD COLUMN abandon_webhook_at TIMESTAMPTZ;
CREATE INDEX chat_lead_abandon_scan_idx
  ON chat_lead(created_at)
  WHERE abandon_webhook_at IS NULL AND purchased_at IS NULL AND phone_e164 IS NOT NULL;
```

---

## 5. Stratégie de tests

### Vitest unit (`src/lib/webhooks/outbound/__tests__/`)

- **`payload.test.ts`** — schéma Zod : champs requis, defaults, normalisation, omission des null.
- **`from-*.test.ts`** (5 fichiers) — un par source, builders → payload conforme aux fixtures.
- **`dispatcher.test.ts`** — phone-gate, idempotency-key, headers HMAC corrects.

### Vitest intégration MSW (`src/test/integration/`)

- **`outbound-webhook-order.test.ts`** — POST /api/checkout/order → webhook reçoit le payload aligné.
- **`outbound-webhook-chat-lead.test.ts`** — POST /api/chat/lead/contact → migration vers nouveau format vérifiée.
- **`outbound-webhook-contact.test.ts`** — POST /api/contact (avec/sans phone).
- **`outbound-webhook-cart-abandon.test.ts`** — seed lead idle → cron tick → webhook fired.
- **`outbound-webhook-skip-invalid-phone.test.ts`** — phone invalide → status `skipped`.

> **Note** : le projet utilise Vitest, runner test-compatible et 100% syntaxe Jest (mêmes APIs `describe`/`it`/`expect`/`beforeEach`/`vi.fn` = `jest.fn`). Si la commande `pnpm test` ou `pnpm jest` est attendue, les deux pointent vers Vitest.

### Playwright e2e (`apps/web/e2e/`)

- **`webhook-chat-lead.spec.ts`** — ouvrir chat, capturer lead, intercepter via Next route locale `/api/_mock-webhook` (monté en mode test).
- **`webhook-contact-form.spec.ts`** — remplir contact form pro, intercepter.
- **`webhook-checkout-full.spec.ts`** — full checkout funnel → webhook reçu avec payload 100% rempli.

L'endpoint mock test (`/api/_mock-webhook`) est conditionnel à `NEXT_PUBLIC_E2E=true` et n'est PAS exposé en production.

---

## 6. Smoke test manuel

```bash
# 1. Mettre OUTBOUND_WEBHOOK_URL pointant vers https://webhook.site/<uuid>
# 2. Démarrer le dev server
pnpm dev

# 3. Déclencher un événement (ordre via checkout, ou chat lead via /api/chat/lead/contact)
curl -X POST http://localhost:3000/api/contact \
  -H 'content-type: application/json' \
  -d '{"type":"professional","name":"Test Prod","email":"t@e.com","phone":"0661234567","message":"hi","gdprConsent":true}'

# 4. Vérifier sur webhook.site que le payload reçu correspond au contrat.
# 5. Inspecter la table outbound_webhook_log
psql "$DATABASE_URL" -c "SELECT id, source, status, attempt_count, response_status FROM outbound_webhook_log ORDER BY created_at DESC LIMIT 10;"
```

---

## 7. Plan d'exécution

| Phase | Livrable | Fichiers |
|---|---|---|
| 0 | Runbook (ce fichier) | `docs/webhooks/outbound-webhook-runbook.md` |
| 1 | Migration + foundations | `drizzle/migrations/0026_*.sql`, `src/lib/webhooks/outbound/{payload,dispatcher,log-queries}.ts`, `src/lib/env.ts` |
| 2 | Trigger order | `src/lib/webhooks/outbound/sources/from-order.ts`, hook dans `route.ts` |
| 3 | Trigger chat lead | `src/lib/webhooks/outbound/sources/from-chat-lead.ts`, refit `lead-webhook.ts` |
| 4 | Trigger contact + newsletter | `from-contact.ts`, `from-newsletter.ts`, hooks routes |
| 5 | Trigger cart abandon | `from-cart-abandon.ts`, `cart-abandon-scanner.ts`, hook cron tick |
| 6 | Tests Vitest + MSW | `src/lib/webhooks/outbound/__tests__/*`, `src/test/integration/outbound-webhook-*.test.ts` |
| 7 | Tests Playwright | `apps/web/e2e/webhook-*.spec.ts` |
| 8 | Validation | `pnpm tsc --noEmit && pnpm vitest run && pnpm lint` |

---

## 8. Rollback

- Désactiver : retirer `OUTBOUND_WEBHOOK_URL` et `CHAT_LEAD_WEBHOOK_URL` → tous les triggers retournent `disabled` sans erreur.
- Rollback DB : `DROP TABLE outbound_webhook_log; ALTER TABLE chat_lead DROP COLUMN abandon_webhook_at;` (table journalisation seulement, aucune perte de données métier).
- Rollback code : `git revert` du commit feat(webhook): outbound unified payload.
