# 02 — Backend & API

> **Vue d'ensemble** : 279 routes API, regroupées en 7 domaines (admin, chat, checkout, cron, track, webhooks, public). Patterns transverses solides (Zod, `HttpError`, idempotence, audit logging). Trois faiblesses : rate-limit incomplet, 47 `console.*` résiduels, validation cron répétée. Aucune `any` ni N+1 détecté sur les routes critiques.

---

## 1. Inventaire des routes API

279 routes identifiées sous `src/app/api/`, distribuées :

| Domaine | Préfixe | Volume approximatif | Exemples |
|---|---|---|---|
| Admin analytics | `/api/admin/analytics/` | 18 | overview, funnel, sankey, insights/refresh |
| Admin chat | `/api/admin/chat/` | 35+ | FAQs, providers, leads, export, settings |
| Admin catalog | `/api/admin/catalog/` | 8 | products, autocomplete |
| Admin components | `/api/admin/components/` | 12+ | fields, versions, bindings |
| Admin leads | `/api/admin/leads/` | 8 | tags, status, events, export |
| Admin webhooks, emails, media, products, SEO, tracking, ... | `/api/admin/*` | 40+ | |
| Checkout | `/api/checkout/` | 10 | lead, order, address, payment, stock |
| Chat | `/api/chat/` | 15 | message (SSE), session, lead, event, feedback |
| Cron | `/api/cron/` | 20+ | tick, tracking-purge, media-optimize, ... |
| Tracking | `/api/track/` | 8 | pixels, consent, attribution |
| Webhooks entrants | `/api/webhooks/` + `/api/mail/webhook/*` | 6 | Stripe, Stalwart, Listmonk |
| Webhooks sortants admin | `/api/admin/webhooks/*` | 6 | endpoints, deliveries, retry |
| Public | `/api/{contact,newsletter,legal,articles,...}` | 25+ | |

**Total ≈ 279 routes**. Volumétrie élevée mais cohérente avec un produit qui fait à la fois e-commerce + chat + admin riche + tracking server-side.

---

## 2. Patterns transverses

### 2.1 Validation Zod systématique

100 % des routes publiques utilisent `schema.safeParse(body)` + `zodErrorResponse(parsed.error)`. Schémas réutilisables (`emailSchema`, `phoneMaroc9DigitsSchema`, `cartSnapshotSchema`).

**Exemple de finesse** — consentement RGPD forcé en `z.literal(true)` plutôt que `z.boolean()` :
```ts
// src/lib/checkout/schemas/lead.ts:48-50
consent: z.literal(true, {
  errorMap: () => ({ message: 'Consentement RGPD requis.' }),
}),
```
→ Impossible d'avoir un lead avec `consent=false` qui passe la validation. Excellent.

### 2.2 Idempotence

Middleware `withIdempotency` couvre les scopes `lead_create`, `order_create`, `address_update`, `payment_update`. Clé : header `Idempotency-Key`, table `checkout_idempotency`, TTL 15 min.

**Exemple `POST /api/checkout/order`** (`src/app/api/checkout/order/route.ts` + `src/lib/checkout/repos/order-repo.ts:60-76`) :

```ts
const result = await withIdempotency<OrderResp>({
  request: req,
  scope: 'order_create',
  payload: parsed.data,
  execute: async () => {
    // 1. Re-valide prix côté serveur (anti-tampering) en re-fetch product_variants par SKU
    // 2. Réserve stock atomiquement (CAS) — rollback si une SKU échoue
    // 3. Crée l'order + items
    // 4. Dispatch webhook + email transactional
  },
});
```

Garanties offertes :
- Replay safe (réutilisation Idempotency-Key → cached response).
- Tampering du `expectedTotalCents` détecté → `PriceMismatchError`.
- Stock partiellement insuffisant → `StockInsufficientError` avec détails par SKU.

### 2.3 Auth admin

```ts
const auth = await requireAdminApi();
if (!auth.ok) return auth.response;
```
- `requireAdminApi` → décrypte cookie iron-session → vérifie TTL → 401 sinon.
- Sur les mutations, doubler avec `await requireSameOrigin(request)` (CSRF defense-in-depth) — partiellement appliqué, à généraliser.

### 2.4 Auth cron — anti-pattern à factoriser

Répété 15 fois identiquement :
```ts
const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
if (!process.env.CRON_SECRET || auth !== expected) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Recommandation** :
```ts
// src/lib/http/cron-auth.ts
export function requireCronSecret(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return { ok: false, response: new Response('Unauthorized', { status: 401 }) };
  }
  return { ok: true };
}
```
→ DRY + tests centralisés.

### 2.5 Streaming SSE (chat)

`POST /api/chat/message` (`src/app/api/chat/message/route.ts`) — pattern :
- Rate-limit double : `session` puis `ip` (`rateLimit.consume`).
- `streamSSE` consomme un async iterator (`streamReply` orchestre LLM → events).
- `AbortSignal` propagé sur disconnect client → évite les fuites de tokens LLM (économie €).
- Feature flag `assertChatEnabled()` → 404 si désactivé.

C'est l'une des routes les mieux écrites du repo.

### 2.6 Gestion d'erreurs

Classe `HttpError` (`src/lib/errors/http-error.ts`) avec codes typés :
```ts
type ErrorCode = 'unauthorized' | 'forbidden' | 'not_found' | 'invalid_input'
              | 'invalid_state' | 'rate_limited' | 'conflict' | ...;
```

**Couverture** : ≈ 68 % des routes. Reste 30 % qui retournent du JSON adhoc → à harmoniser.

### 2.7 Audit logging

`logAuditEvent(action, resourceType, resourceId, meta)` appelé sur toutes les mutations admin sensibles. Stocké dans `audit_events` (action, actor_id, resource_type, resource_id, meta JSONB, created_at).

---

## 3. Routes critiques — analyse détaillée

### 3.1 `POST /api/checkout/lead` (96 LOC)

✅ Validation Zod stricte, idempotence, logging événement, audit trail.
❌ **Pas de rate-limiting**. Vulnérable au lead-spamming massif.

**Reco** :
```ts
const ip = extractClientIp(req);
const gate = await rateLimit.consume('checkout_lead', ip, { max: 30, window: '1h' });
if (!gate.allowed) return new Response(JSON.stringify({ error: 'rate-limited' }), { status: 429 });
```

### 3.2 `POST /api/checkout/order` (263 LOC) — la plus critique

✅ Validation Zod + idempotence + re-validation prix serveur + stock CAS + dispatch webhook post-commit + email transactional.
🟡 `console.error('...', e)` ligne ~75 → remplacer par `logger.error`.
🟡 Auto-select payment si absent (CHA-231 tolère shortcut UI) → bien commenté mais fragile. Ajouter test e2e du cas "user accède direct au order sans avoir cliqué le bouton paiement".

### 3.3 `POST /api/chat/message`

✅ Rate-limit dual, abort signal, SSE streaming, feature flag, IP extraction robuste.
✅ Probablement la route la plus mature du repo.

### 3.4 `POST /api/track/consent`

✅ Validation stricte sur `consentInputSchema`, persistance cookie + localStorage + event `fg:consent-changed`.

### 3.5 `POST /api/admin/chat/faq/`

✅ Auth admin obligatoire, embedding provider, 503 si provider indispo (pas de fallback silencieux → cohérent).

### 3.6 Webhooks entrants

| Source | Route | Mécanisme |
|---|---|---|
| Stripe | `/api/stripe/webhook` | `Stripe-Signature` HMAC, `STRIPE_WEBHOOK_SECRET` |
| Stalwart | `/api/mail/webhook/stalwart` | header `X-FG-Webhook-Token`, `timingSafeEqual` |
| Listmonk | `/api/mail/webhook/listmonk` | Bearer HMAC-SHA256 |

✅ Constant-time comparison partout. Rate-limit `webhook-stalwart` 600 req/min.

### 3.7 Webhooks sortants

`lib/webhooks/engine.ts` (195 LOC) :
- `enqueueDelivery()` → idempotency via `(endpoint_id, idempotency_key)` UNIQUE index.
- `attemptDelivery()` → fetch timeout 10 s, signature HMAC SHA-256.
- `processBatch()` → réclame 50 deliveries pending, retry exponentiel `computeBackoff()`, max 8 tentatives, audit trail.
- Tests `engine.test.ts` (229 LOC, 7 scénarios : success / retry / timeout / abort / failure).

✅ État de l'art pour un dispatcher webhook outbound.

---

## 4. Forces backend

1. **Validation Zod 100 %** sur routes publiques + schémas réutilisables.
2. **Typage strict** — `strict: true`, `noUncheckedIndexedAccess`, aucune `any` dans les routes core.
3. **Idempotence opérationnelle** sur lead/order/address/payment + webhooks (inbound + outbound).
4. **Atomicité DB** : stock CAS, transactions Drizzle, FK CASCADE pertinents.
5. **Sécurité applicative** : Argon2id, iron-session, CSP nonce, HMAC partout, gitleaks pre-commit.
6. **Audit trail systématique** sur les mutations admin (`audit_events`).
7. **Logger structuré** (`lib/logging/logger.ts`) : JSON, niveaux, redaction PII (25 clés sensibles automatiquement masquées).
8. **Crons Vercel natifs** déclarés dans `vercel.json` (15 jobs) + scripts admin pour run manual.
9. **Pas de N+1 query** détecté dans les chemins critiques (Drizzle `inArray`, batch fetches).

---

## 5. Faiblesses backend

| # | Constat | Fichier(s) | Sévérité |
|---|---|---|---|
| F1 | **Rate-limit absent** sur `/api/checkout/lead`, `/api/contact`, `/api/newsletter` (présent uniquement chat + mail) | `src/app/api/checkout/lead/route.ts`, `src/app/api/contact/route.ts` | 🔴 P0 |
| F2 | **47 `console.log/error/warn`** non remplacés par logger structuré | `src/app/error.tsx:18`, `src/app/admin/rituals/insights/page.tsx:42`, `src/app/api/admin/rituals/bulk-action/route.ts`, ... | 🟡 P1 |
| F3 | **Validation cron répétée 15 fois** identiquement | tous les `src/app/api/cron/*/route.ts` | 🟡 P1 |
| F4 | **`HttpError` pas généralisé** (≈ 30 % des routes retournent JSON adhoc) | divers `/api/admin/*` | 🟡 P2 |
| F5 | **Tests crypto manquants** (Argon2, HMAC, AES-GCM webhook encryption) | `src/lib/auth/password.ts`, `src/lib/crypto/encryption.ts` | 🟠 P1 |
| F6 | **Tests mail transactional manquants** | `src/lib/mail/send.ts` | 🟡 P2 |
| F7 | **Tests routes analytics admin manquants** (~40 routes) | `src/app/api/admin/analytics/*` | 🟡 P2 |
| F8 | **Pas de check OpenAPI / schema export** : le contrat API n'est pas publié, ce qui complique l'intégration tiers (webhooks consommateurs, mobile future) | global | 🟡 P2 |
| F9 | **Logger vs console** : la transition vers `logger` est entamée mais incomplète. Risque : 2 systèmes de logs en parallèle, lecture confuse. | global | 🟡 P2 |
| F10 | **CSRF token explicite absent** (couvert par sameSite=lax + `requireSameOrigin`, mais moins robuste qu'un double-submit cookie) | `src/lib/legal/csrf.ts` | 🟡 P2 |

---

## 6. Recommandations concrètes

### Priorité critique (P0)
1. **Rate-limit sur `/api/checkout/lead`** (et `/api/contact`, `/api/newsletter`) — copier le pattern chat :
   ```ts
   const ip = extractClientIp(req);
   const gate = await rateLimit.consume('checkout_lead', ip, { max: 30, window: '1h' });
   if (!gate.allowed) return new Response('rate-limited', { status: 429 });
   ```
   **Effort** : 1–2 h (incluant tests).

### Priorité haute (P1)
2. **Migrer 47 `console.*` → `logger.*`** :
   ```ts
   // Avant
   console.error('[error.tsx]', error);
   // Après
   logger.error('app.error.boundary', { error: error.message, stack: error.stack });
   ```
   **Effort** : 1–2 h.

3. **Factoriser `requireCronSecret`** dans `src/lib/http/cron-auth.ts`. Remplacer les 15 occurrences inline.
   **Effort** : 1 h.

4. **Ajouter tests crypto + HMAC** (`password.test.ts`, `encryption.test.ts`, `hmac.test.ts`).
   **Effort** : 2–3 h.

### Priorité moyenne (P2)
5. **Généraliser `HttpError`** sur les ~30 % de routes restantes (admin notamment).
   **Effort** : 4–6 h.

6. **Couvrir analytics admin** (~40 routes) avec tests d'intégration légers (Vitest + supertest-like).
   **Effort** : 3–4 h.

7. **Exporter un OpenAPI** depuis les schémas Zod (zod-to-openapi). Bénéfice : doc auto, types client, tests contrat.
   **Effort** : 1 jour.

8. **Tests mail transactional** (MSW mock du provider, vérif templates Handlebars).
   **Effort** : 2 h.

---

## 7. Patterns à promouvoir

À documenter dans un `docs/architecture/patterns.md` futur :

1. **Validation Zod + `zodErrorResponse`**.
2. **`withIdempotency` middleware**.
3. **`requireAdminApi` + `requireSameOrigin` (defense in depth)**.
4. **Atomicité stock CAS** (`order-repo.createOrder`).
5. **SSE streaming + AbortSignal** (`/api/chat/message`).
6. **HMAC constant-time webhook auth** (`timingSafeEqual`).
7. **Logger structuré + PII redaction** (`lib/logging/logger.ts`).
8. **Audit trail via `logAuditEvent`** (`lib/audit/`).

---

## 8. Scorecard backend

| Critère | Score | Commentaire |
|---|---|---|
| Validation des entrées | 10 / 10 | Zod systématique |
| Typage | 9 / 10 | TS strict, pas d'`any` |
| Gestion d'erreurs | 7,5 / 10 | `HttpError` partiel |
| Idempotence | 9 / 10 | Excellent sur le commerce |
| Atomicité DB | 9 / 10 | CAS, transactions, FK cascade |
| Sécurité applicative | 8 / 10 | Bonnes briques, rate-limit partiel |
| Observabilité (logs) | 6 / 10 | Logger OK mais `console.*` résiduels |
| Tests backend | 6,5 / 10 | Core OK, mail/analytics/crypto absent |
| Documentation API | 4 / 10 | Pas d'OpenAPI publié |
| **Global** | **7,7 / 10** | |
