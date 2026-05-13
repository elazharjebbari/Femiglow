# Audit global FemiGlow — 2026-05

> Lecture seule. Audit produit le 2026-05-13, branche `master`, HEAD `8f2f4dc`.
> Périmètre : `apps/web/` (monorepo pnpm, application unique Next.js 14).
> Méthode : exploration cold + 5 lots d'agents parallèles (S1‑S13) + cross‑cutting.

---

## 0. Synthèse exécutive

### 0.1 Lecture en une page

Le codebase FemiGlow Phase 1 a quitté depuis longtemps son cahier des charges initial. La [docs/preparation/06-architecture-technique.md:107](../preparation/06-architecture-technique.md) prévoyait un mock JSON (`src/data/*.json`), un adapter CMS minimal et une dizaine de routes API. Le `master` contient **27 migrations Drizzle**, **160+ routes API** dont une centaine sous `/api/admin/**`, neuf seeders idempotents, un chat assistant multi‑provider LangChain, un wall reviews avec modération vision‑ML, un GTM container versionné, un media pipeline `sharp+ffmpeg`, des webhooks outbound HMAC, des matviews analytics, du form‑config versionné. Ce n'est plus un prototype : c'est un produit Phase‑1‑plus déguisé en Phase 1.

Cette inflation se voit dans la qualité : la fondation est **solide là où elle compte** (Drizzle dual‑driver propre, Zod aux frontières, idempotence checkout, audit‑trail composants, HMAC signé, redaction PII des logs, CSP justifiée). Elle est **fragile là où la pression a écrasé la rigueur** (admin RBAC seedé mais non appliqué, GTM `pixelId` interpolé sans schéma, signed URLs media déclarés en env mais non utilisés, plusieurs routes publiques sans rate‑limit, doc préparation désynchronisée).

Scores sur 5 (subjectif tech‑lead, ancré sur les preuves citées dans le corps) :

| Axe | Score | Justification courte |
|---|---|---|
| Backend (modèle, routes, intégrité) | 4 / 5 | Drizzle/Zod/idempotence/audit cleans ; quelques routes publiques non rate‑limitées |
| Frontend (RSC/Client, perf, hydratation) | 3.5 / 5 | Boundaries généralement justes, qq cas localStorage pour leadId, dynamic imports honnêtes |
| UI (charte, atomes) | 4 / 5 | Tokens CSS + Heading/Kicker/Text/Container appliqués partout, palette tenue |
| UX (parcours, frictions) | 3.5 / 5 | Wizard checkout net ; quelques sticky CTA & feedback scroll perfectibles |
| Design / voix éditoriale | 4.5 / 5 | Voix sensorielle sans superlatif tenue, copywriting Kolenda inscrit dans le builder feed |
| Ergonomie admin | 3 / 5 | Riche mais ergonomique : RBAC seedé sans gate, pas de 2FA, jobs seeders en RAM |
| Accessibilité | 3.5 / 5 | Sémantique correcte, skip‑link discret, contrastes pastilles à mesurer |
| Fonctionnel (E2E) | 3.5 / 5 | Checkout marche, chat gated `CHAT_ENABLED`, signed URLs media manquants, RBAC inactif |

### 0.2 Top 5 forces

1. **Drizzle dual‑driver propre.** `db()` retourne `null` si pas de `DATABASE_URL`, l'appelant retombe sur `memoryStore()` exposé en `globalThis.__femiglowStore`. ([db/client.ts:155‑190](../../apps/web/src/lib/db/client.ts)). Permet vitest sans Postgres ET prod Neon/Postgres‑JS, sans flag conditionnel disséminé.
2. **Idempotence checkout outillée.** Table `checkout_idempotency` (clé, scope, hash, response_json, TTL 24h) + middleware `withIdempotency` + `hashRequestPayload` canonique ([migration 0021](../../apps/web/drizzle/migrations/0021_checkout_idempotency.sql), `lib/checkout/repos/idempotency-repo.ts`). Replay sûr y compris en cas de hash mismatch (409).
3. **Webhooks outbound disciplinés.** Dispatcher unifié HMAC‑SHA‑256 + `timingSafeEqual` + retry exponentiel [1 s, 3 s, 9 s] + idempotency `<source>:<sourceId>` + audit log ([lib/webhooks/outbound/dispatcher.ts](../../apps/web/src/lib/webhooks/outbound/dispatcher.ts), migration 0026).
4. **CMS Components versionné.** Bindings `(component_id, field_key, locale)` × 4 statuts (`draft|published|scheduled|archived`) + optimistic locking `If‑Match` + `component_field_history` insert‑only + invalidation `revalidateTag('components:fields:${key}:${locale}')` ([migration 0005_components_cms.sql](../../apps/web/drizzle/migrations/0005_components_cms.sql)). Audit trail intrinsèque.
5. **Voix éditoriale tenue jusque dans le code.** `sanitize-body` applique apostrophes courbes U+2019 et fines insécables U+202F avant ponctuations FR ([lib/rituals/sanitize-body.ts](../../apps/web/src/lib/rituals/sanitize-body.ts)). Builder feed kit applique principes Kolenda (présent, premier geste « complete », social proof condensé) sans copywriting durci dans les composants ([lib/products/feed/kit-feed.ts](../../apps/web/src/lib/products/feed/kit-feed.ts)).

### 0.3 Top 5 risques

1. **[H] RBAC seedé, non appliqué.** Page `/admin/settings/rbac/` existe, `rbacSeeder` enregistré dans la registry, mais **aucune route `/api/admin/**` ne checke la matrice de permissions**. Tout admin = full‑power. Mitigation : middleware `enforcePermission(action, resource)` à insérer avant `requireAdminApi()`.
2. **[H] Signed URLs media non implémentés.** `MEDIA_SIGNED_URL_SECRET` est défini et validé `min(32)` dans [env.ts:24](../../apps/web/src/lib/env.ts), mais aucune route ne l'utilise. Vercel Blob URLs sont publiques (`addRandomSuffix: false`). Hotlink + scraping triviaux. Mitigation : HMAC sur `/api/media/[idOrSlug]` avec `?sig=…&exp=…`.
3. **[H] GTM `pixelId` interpolé brut.** [lib/tracking/providers/gtm.ts](../../apps/web/src/lib/tracking/providers/gtm.ts) construit le snippet GTM via concaténation de chaînes incluant `provider.pixelId` ; pas de schéma `regex(/^G‑[A-Z0-9]+$/)` ni d'échappement. Si un admin entre `')+alert(1)//`, XSS via `dataLayer`. Mitigation : Zod regex stricte sur les configs trackers.
4. **[H] Rate‑limit absent sur trois routes publiques exposées.** `POST /api/newsletter`, `POST /api/contact`, `POST /api/checkout/lead` n'invoquent pas `checkRateLimit`. Lead spam, polluage tracking, et lecture biaisée de tous les KPIs funnel en aval. Le module `lib/rate-limit/check.ts` existe mais est inutilisé par S2/S11.
5. **[M→H] Stock CAS à confirmer.** `stockRepo.reserve()` est appelé dans la transaction `createOrder` ; selon que la requête est `UPDATE ... WHERE id = ? AND available_qty >= ?` (CAS optimistic) ou un simple `UPDATE` sans `WHERE qty >= n`, le risque d'oversell sous concurrence est réel. Migration 0019 ajoute `product_stock` mais ne porte pas de check‑constraint d'invariant non‑négatif. **À vérifier** par lecture directe de `lib/checkout/repos/stock-repo.ts` avant deploy paiement live.

### 0.4 Top 5 quick wins (effort × impact)

1. **Schéma Zod sur `pixelId` GTM** — 30 min, impact critique XSS.
2. **Rate‑limit `/api/newsletter`, `/api/contact`, `/api/checkout/lead`** — 1 h, impact critique anti‑spam, déjà outillé via `lib/rate-limit/`.
3. **Externaliser `CONTACT_EMAIL` en env var** — 30 min, impact « la doc dit que cette adresse va changer », évite un rebuild.
4. **Skip‑link visible** — 30 min, [components/layout/Header.tsx](../../apps/web/src/components/layout/Header.tsx) a déjà la cible `#main`, manque le `<a className="sr-only focus:not-sr-only">`.
5. **Health endpoint vérifiant DB** — 30 min, [api/health/route.ts](../../apps/web/src/app/api/health/route.ts) renvoie aujourd'hui `{status:'ok'}` sans toucher la DB ; un faux positif bloquera un rollback.

---

## 1. Architecture & cross‑cutting

### 1.1 Stack effective

| Couche | Outil | Statut vs doc/06 |
|---|---|---|
| Framework | Next.js 14.2.15 App Router | ✓ |
| Runtime | Node ≥ 20 | ✓ |
| ORM | Drizzle 0.45 dual‑driver Neon HTTP / postgres‑js | non documenté (doc prévoyait mock JSON) |
| Validation | Zod 3.23 | ✓ |
| Auth admin | `iron-session` 8 + argon2 `@node-rs/argon2` | non documenté |
| Chat LLM | LangChain (`@langchain/openai|anthropic|google-genai|mistralai|community|ollama`) | non documenté |
| State client | Zustand 5 | ✓ |
| Email | placeholder Resend non câblé | en attente |
| Test | Vitest 2.1 + MSW 2 + Playwright 1.48 | ✓ |
| Animations | framer‑motion 11 | ✓ |
| Media | `sharp` 0.34, `fluent‑ffmpeg`, `file-type`, `music-metadata`, `pdfjs-dist`, `mammoth` | non documenté |

Le `package.json` charge **6 SDK LangChain en runtime** (OpenAI, Anthropic, Gemini, Mistral, Ollama, Community) — payload non négligeable pour des features gardées par défaut `CHAT_ENABLED=false`. À envisager : lazy import providers par configuration.

### 1.2 Dual‑driver mémoire / DB

`db()` cache son instance dans `globalThis.__femiglowDb`, détecte `neon.tech|neon.build` pour basculer entre `drizzle-orm/neon-http` et `drizzle-orm/postgres-js` ([db/client.ts:171‑190](../../apps/web/src/lib/db/client.ts)). `memoryStore()` est tenu sur `globalThis.__femiglowStore`. Cette discipline rend la grande majorité des repos testables sans Postgres et survit aux HMR Next.js.

**Risque** : la duplication des chemins « si DB sinon mémoire » dans chaque repo est un terrain fertile pour les divergences. Plusieurs services (notamment `lib/rituals/`) commentent ce pattern « DB d'abord puis mémoire fallback » ; un linter custom (ESLint `no-restricted-imports` ou Plop generator) limiterait la dérive.

### 1.3 Middleware (CSP, HSTS, auth admin, proxy)

[middleware.ts:1‑140](../../apps/web/src/middleware.ts) est lucide :

- CSP justifiée en commentaire : `'unsafe-inline'` retenu plutôt que `nonce 'strict-dynamic'` car Next 14 n'appose pas le nonce sur ses propres scripts RSC. Choix documenté, pas une omission.
- HSTS uniquement en prod (sinon localhost HTTP grillé 2 ans).
- `frame-src 'self' https://www.youtube-nocookie.com` (CHA‑243 embed YouTube privacy‑friendly).
- `allowSelfFraming` ciblé sur `/admin/components/*/preview` uniquement (live preview admin), partout ailleurs `frame-ancestors 'none'` + `x-frame-options: DENY`.
- Redirect `/admin/login?next=…` respecte `X-Forwarded-Host`/`Proto` (déploiement derrière LiteSpeed bind 127.0.0.1:8011).
- `x-robots-tag: noindex, nofollow` + `cache-control: no-store` sur tout `/admin/**` et `/api/admin/**`.

**Risque [L]** : la CSP `script-src 'unsafe-inline'` est explicitement admise. Le commentaire promet « inputs sanitizés côté serveur » mais cette promesse n'est pas tenue à 100 % (cf. risque H GTM `pixelId`). Acceptable en Phase 1 si l'admin est restreint, mais à durcir avant ouverture B2B.

### 1.4 Erreurs typées

[lib/errors/http-error.ts](../../apps/web/src/lib/errors/http-error.ts) définit 13 codes (`unauthorized`, `forbidden`, `not_found`, `invalid_input`, `invalid_state`, `rate_limited`, `conflict`, `upstream_failed`, `internal_error`, `validation_failed`, `version_conflict`, `field_removed`, `schedule_in_past`) avec mapping statut HTTP. `formatErrorResponse` est l'unique sortie « clean » des routes API.

**Risque [L]** : la branche `err non‑HttpError` retourne `{code:'internal_error', message:'Erreur interne'}` sans logger l'objet brut. Si une route oublie de `try/catch` un service qui throw `Error`, l'opérateur n'a aucun breadcrumb. À harmoniser : `formatErrorResponse` devrait `logger.error({ err })` avant de retourner le 500 générique.

### 1.5 Env contract

[lib/env.ts:3‑65](../../apps/web/src/lib/env.ts) parse 33 variables. Bonnes pratiques :

- Secrets obligatoires (`ADMIN_SESSION_PASSWORD`, `WEBHOOK_SECRET_KEY`, `CRON_SECRET`, `MEDIA_SIGNED_URL_SECRET`, `CHAT_LEAD_WEBHOOK_SECRET`, `OUTBOUND_WEBHOOK_SECRET`) tous typés `.min(32)` ou `.min(16)`.
- Booléens passés en `'true'|'false'` string puis coerce — Next.js limite, pas un bug.
- Defaults sains : `LOG_LEVEL=info`, `MAINTENANCE_MODE=false`, `MEDIA_MAX_BYTES=50 MB`.
- `CMS_PROVIDER: 'mock'|'sanity'` reste typé mais n'est plus la vraie source : le CMS Components est en DB. À vérifier : que fait le code si `CMS_PROVIDER=sanity` est positionné ? La doc 06 prévoyait ce switch, je n'ai pas vu d'implémentation Sanity dans `lib/cms/`.

### 1.6 Drift documentation ↔ code

Cinq écarts notables avec [docs/preparation/07-modeles-donnees-api.md](../preparation/07-modeles-donnees-api.md) :

- Prix : doc `price: z.number()` (montant majeur) → code `priceCents: z.number().int()`.
- Order ID : doc `FG-YYYY-NNNNN` regex → code UUID opaque sans formatter de présentation.
- Payment modes : doc `{card, cod}` → code `{cod, bank_transfer, card}`.
- Shipping modes : doc `{standard, express}` → code `{standard, express, pickup}`.
- API surface : doc liste 10 routes → réalité 160+ routes.

**Action transverse** : aligner la doc préparation OU ajouter dans `docs/audit/` un encart « le code fait foi, voici les divergences acceptées ». Aujourd'hui un dev qui découvre le repo via la doc se trompe.

### 1.7 Dette transversale visible

- **Logs stdout‑only.** [lib/logging/logger.ts:1‑105](../../apps/web/src/lib/logging/logger.ts) émet du JSON structuré avec PII redaction (~50 keys), mais aucun shipping. Sur Vercel les logs sont récupérés par défaut ; ailleurs (LiteSpeed bind 8011), ils se perdent au restart.
- **Buffer events seeders 500 max.** [lib/seeders/job-store.ts](../../apps/web/src/lib/seeders/) garde les jobs en RAM ; un restart en plein seed = état perdu.
- **Component field history sans purge.** `component_field_history` croît indéfiniment. Le cron `/api/cron/purge-field-history/route.ts` existe → à vérifier : est‑il actif et fait‑il quelque chose ?
- **GTM config last‑write‑wins.** Pas d'optimistic lock dans `lib/tracking/gtm/config-store.ts` ; deux admins simultanés = perte silencieuse.

---

## S1. Catalogue produit + feed Kolenda

### Backend

Migration [0008_products_cms.sql](../../apps/web/drizzle/migrations/0008_products_cms.sql) pose un modèle propre : `products (status enum, slug UNIQUE)`, `product_variants (FK CASCADE, CHECK promo < prix)`, `product_snapshots` pour audit, index `(status, published_at)` et `(product_id, position)` sur les lectures chaudes. Migration 0019 ajoute `product_stock`.

`lib/products/schemas.ts` utilise `.strict()` partout, `variantCurrencySchema` normalise en majuscules avec whitelist `SUPPORTED_CURRENCIES`, `promoPriceCents` redouble la contrainte DB via `refine`. Cohérent et serré.

Routes admin :
- `POST /api/admin/products` retourne 201/409, audit log, auth via `getAdminSession()`.
- `POST /api/admin/products/feed/revalidate` purge cache ISR + Next tags (`revalidateProduct(KIT_PRODUCT_SLUG)` fan‑out 4 paths/tags).
- `GET /api/admin/products` pagination + filtres (status, category, q, sort). **Risque M** : présomption de N+1 sur `listProducts` → à confirmer via lecture `lib/db/queries/products.ts`.

Feed XML Google Merchant : `lib/products/feed/merchant-xml.ts` produit UTF‑8 + CDATA pour accents, `stripInvalidXmlChars` couvre la zone U+0000‑U+001F sauf TAB/LF/CR, fuzz tests présents.

### Frontend

`ProductFeedSection` est entièrement piloté par props (`feed` injecté), zéro texte durci ; copywriting Kolenda condensé en builder serveur. `CommanderAnchorButton` scroll‑anchor vers `#commander-femiglow` (CHA‑231), respecte `prefers-reduced-motion`. Pas de feedback visuel pendant le scroll → **friction L** sur mobile lent.

### UI/UX

Conforme charte : Cormorant display, Inter body, pastilles `sauge / petale / champagne`. Le quatrième `ciel` est inutilisé sur la section — cohérence visuelle, pas un bug.

### Design / philosophie

Builder feed applique Kolenda #1 (présent), #21 (premier geste « complete »), #29 (social proof condensé), #34 (framing impact sur les autres). Copy non durcie dans les composants : single source of truth pour le narrative kit unique.

### Ergonomie

Anchoring prix (190 dh / 390 dh seed depuis commit `88c5c1e`), mais le feed copy ne peut pas être A/B testé sans redeploy (durci dans `kit-feed.ts`). Kolenda Pricing #14 (« precise digits ») suggère un mécanisme d'externalisation.

### Accessibilité

`aria-labelledby="product-feed-title"` ✓. Pastilles soft sur fond crème : contraste à mesurer Lighthouse (suspicion < 4.5:1).

### Fonctionnel

E2E OK : feed XML servi avec ISR 30 min via `getCachedKitFeedXml`. Fallback image `${origin}/og/kit.png` non vérifié en CI — un 404 cassera l'ingestion Google Merchant silencieusement.

### Forces / risques / recos

- F1 Migration‑first + index ciblés.
- F2 Feed Kolenda en builder pur, copy non scattered.
- F3 Fuzz tests XML.
- R1 [M] N+1 potentiel `listProducts` à confirmer.
- R2 [M] Feed copy hard‑coded → A/B impossible.
- R3 [L] Fallback OG image non garanti en CI.
- Reco 1 Externaliser feed copy en JSON CMS (3 h, impact M).
- Reco 2 Ajouter `--check-og-images` au CI (1 h, impact L).
- Reco 3 Mesurer contraste pastilles + ajuster `--color-sauge-soft` si < AA (1 h, impact M a11y).

---

## S2. Tunnel commande / checkout

### Backend

Migrations [0017_orders_funnel_extensions.sql](../../apps/web/drizzle/migrations/0017_orders_funnel_extensions.sql) (FK `orders.chat_lead_id`, CHECK NOT VALID rétro‑compat) et [0021_checkout_idempotency.sql](../../apps/web/drizzle/migrations/0021_checkout_idempotency.sql) (clé+scope+hash+response+TTL 24 h) constituent la colonne vertébrale.

Schémas Zod épais et corrects :
- `createLeadInputSchema` : firstName + phone (9 chiffres MA + helper `normalizePhoneToE164Maroc`) + consent literal true + UTM/gclid/fbp/fbc.
- `createOrderInputSchema` : items 1‑20, `expectedTotalCents`, `paymentMethod ∈ {cod, bank_transfer, card}`.
- `CheckoutErrorCode` (`lib/checkout/api/response.ts`) : 9 codes (`invalid_json`, `invalid_input`, `idempotency_conflict`, `not_found`, `invalid_state`, `stock_insufficient`, `price_mismatch`, `db_unavailable`, `internal_error`).

Routes :
- `POST /api/checkout/lead` — idempotent (scope `lead_create`), wizard session via `wizardSessionRepo.ensureForWizard`, **pas de rate‑limit** [risque H].
- `PATCH /api/checkout/lead/[id]/address` — idempotent (`address_update`), retour `nextStep ∈ {payment, thank_you}` (CHA‑231 short‑circuit).
- `PATCH /api/checkout/lead/[id]/payment` — idempotent (`payment_select`).
- `POST /api/checkout/order` — pré‑requis lead.addressCompletedAt, tolérance CHA‑231 (auto‑patch payment si manquant), revalidation prix par SKU/slug, réservation stock, audit. Erreurs typées : 422 price_mismatch, 409 stock_insufficient, 400 unknown_sku.
- `POST /api/stripe/webhook` — HMAC vérifié (tolérance 5 min), idempotent par `event_id`, fallback purchase server‑side si event client manquant (60 min lookback).

**Stock atomicity [risque H non confirmé]** : `stockRepo.reserve()` doit être strict CAS ou `SELECT ... FOR UPDATE`. À lire et tester sous 10 commandes concurrentes pour qty=1.

**Idempotency-Key validation** : à vérifier que le middleware valide le format du header (`min(8) max(128)` alnum + `_-`). Sans, un client envoyant clé vide bypass.

### Frontend

`wizard-store` Zustand + persist localStorage clé `wizard-state` (leadId, drafts, currentStep, orderId, cartSnapshot). **Risque M** : `leadId` en localStorage + routes `/api/checkout/lead/[leadId]/…` non protégées par session → XSS = vol leadId = patch arbitraire. Mitigation : httpOnly cookie session checkout.

`MerciClient` reçoit `?order=<orderId>` en query string : leak en `Referer` vers réseaux sociaux/email opens. Préférer cookie.

### UI/UX, Design

Wizard 3 étapes (lead → address → payment) fluide, CHA‑231 a réduit la friction (le button `Commander` scroll vers le wizard inline plutôt que de naviguer). Voix sobre, anchoring 199 dh / 390 dh.

### Ergonomie

Mode B tolère `addressLine1` vide côté serveur (`addressLine1 NULLABLE`), mais l'UI impose min(4). Un user qui efface le champ peut PATCH sans erreur mais commander sans adresse → soit gate côté serveur, soit valider à l'order final.

### Accessibilité

À vérifier : `aria-modal` sur step modal, focus trap, gestion `Escape` sur le wizard. RTL via `dir` attribute mentionné CHA‑231 pour ar — pas vu d'application HTML root.

### Fonctionnel

E2E fonctionne hors Stripe live. Pas de format `FG-YYYY-NNNNN` pour orderId malgré la doc — UUID est utilisé.

### Forces / risques / recos

- F1 Idempotency hash canonique + replay 24 h.
- F2 Stripe webhook fallback 60 min + sig timing‑safe.
- F3 Erreurs typées par code → UI peut router proprement.
- R1 [H] Rate‑limit absent sur `/api/checkout/lead`.
- R2 [H?] Stock CAS à confirmer.
- R3 [M] leadId localStorage + URL → vol XSS / leak Referer.
- Reco 1 Rate‑limit IP+phone 5/min sur `lead` (30 min).
- Reco 2 Load test stock 10 concurrents qty=1 (2 h).
- Reco 3 Cookie httpOnly `fmg_order_id` + formatter `FG‑2026‑00037` (4‑6 h).

---

## S3. Chat assistant + lead capture

### Backend

[lib/chat/db/schema.ts](../../apps/web/src/lib/chat/db/schema.ts) compte 11 tables : `chatSession` (statut, fingerprint, UTM, `forget()` RGPD), `chatMessage` (role, état pending/streaming/sent/error, coût), `chatLead` (cycle pending→webhookSent/failed→outcome, upgrade `inline-contact`), `chatProviderConfig` (clé chiffrée AES‑256‑GCM via `CHAT_PROVIDER_KEY`), `chatRateLimitBucket` (token bucket DB triple : 60/IP/min, 30/session, 90/visitor).

`isChatEnabled()` ([lib/chat/feature-flag.ts](../../apps/web/src/lib/chat/feature-flag.ts)) gate sync `env.CHAT_ENABLED`. 16 routes API testent `assertChatEnabled()` → 404. `ChatWidgetMount` côté serveur retourne `null` si flag off : zéro JS injecté.

Routes publiques :
- `GET /api/chat/session` lazy.
- `POST /api/chat/message` SSE, rate‑limit session+IP (session avant IP).
- `POST /api/chat/lead/contact` honeypot, normalize phone, idempotence 1‑lead‑par‑session avec upgrade `inline-contact` (CHA‑225), webhook async non‑bloquant.

### Frontend

`ChatWidgetMount` est RSC, retourne `null` ou monte `ChatWidget` dynamiquement (client boundary). Session API au mount, SSE stream messages, dataLayer events bind.

### UI/UX, Design, voix

Sanitize messages : strip emojis, apostrophes courbes, fines insécables FR. Instructions versionnées multilingues (`body`, `bodyAr`, `bodyArMa`).

### Ergonomie

Outcome message contextualisé par langue. Lazy session = pas d'INSERT avant first message. 429 + `Retry-After`.

### Accessibilité

À vérifier : `aria-modal` panel chat, focus trap, `Escape`, narration SSE en ARIA live polite/assertive.

### Fonctionnel

Service complet hors prod (CHAT_ENABLED défaut false). Provider router à breaker, 9 providers, lead webhook HMAC, retry via cron. RAG Phase 5 = stub.

### Forces / risques / recos

- F1 Defense‑in‑depth feature flag (env + DB toggle + 404 + zero JS).
- F2 Token bucket triple‑scope persisté.
- F3 RGPD `forget()` anonymise sauf audit trail.
- R1 [M] Token bucket single‑instance, Redis requis > 1000 RPM.
- R2 [M] `parsePhone()` MA edge cases (fixe 0522, mobile 6xx/7xx) à élargir.
- R3 [H?] Coût LLM non capé par budget : `CHAT_TOTAL_BUDGET_EUR_MONTHLY` typé mais à vérifier que le cron `chat/billing-reset` et la route message regardent le compteur avant chaque call.
- Reco 1 Brancher Upstash Redis pour buckets (3 h).
- Reco 2 Cap dur sur budget mensuel avec circuit‑breaker (4 h).
- Reco 3 Snapshot des prompts versionnés en backup avant rotation (1 h).

---

## S4. Wall reviews / rituels

### Backend

Migrations [0023_ritual_testimonials.sql](../../apps/web/drizzle/migrations/0023_ritual_testimonials.sql), 0024 (admin indexes), 0025 (audit signature). Enums : `ritual_status (PENDING|APPROVED|REJECTED|HIDDEN)`, `ritual_source (web|email_j45|manual|import_*)`, `ritual_signal (oui|hésite|non)`. Index composites `(status, product_key)`, `featured`, `published_at DESC`, `customer_hash`, `import_batch_id`.

Routes publiques :
- `POST /api/rituals/submit` rate‑limit 1/IP/24 h, sanitize body, auto‑flags (9 signaux : link/email/phone/caps/repetition/short/long/forbidden/emoji), duplicate detect Levenshtein 0.7 sur fenêtre 500 rituels APPROVED/PENDING, email token decode → `verifiedPurchase`, insert PENDING + photo MANUAL_REVIEW.
- `GET /api/rituals/list` filter product_key/tags/signal/featured, cursor pagination, default 12.

Admin :
- `POST /api/admin/rituals/bulk-action` 1000 IDs max, chunked 50, `skipFlagged` option, note obligatoire si destructive.
- Import templates + preview + commit.

Vision‑ML : `safeManualProvider` force MANUAL_REVIEW par défaut → design conservateur. Provider `mediaPipeProvider()` prêt mais non actif.

Cron `/api/cron/rituals-refresh-aggregate` hard‑coded `['pack-femiglow']` ([route.ts:7](../../apps/web/src/app/api/cron/rituals-refresh-aggregate/route.ts)).

### Frontend

`RitualCard` ([components/sections/rituals/RitualCard.tsx](../../apps/web/src/components/sections/rituals/RitualCard.tsx)) marqué `'use client'` depuis le fix commit `7e0e939` (`fix(rituals): éviter onClick RSC dans RitualCard server-rendered`). Variantes layout compact/default, photo lazy.

### UI/UX, Design

Voix authentique sans superlatif. Badge « Reviendrait » = signal confiance sobre. Pas de countdown / urgence.

### Ergonomie

Submit wizard : EXIF strip via sharp, display 1200 px + thumb 240 px WebP, vision‑ML async option. Message rate‑limit FR : « La maison a déjà reçu votre voix récemment ».

### Accessibilité

`aria-labelledby` relie photo button à la quote, `<blockquote>` sémantique, alt descriptif : *« Mains de [prénom], partagées après quelques semaines de rituel »*.

### Fonctionnel

E2E couvert. Sort options (`recommended`, `newest`, `most-liked`) à confirmer implémentés. Email token J+45 verified_purchase ✓.

### Forces / risques / recos

- F1 Pipeline photo défensif (EXIF, magic‑byte, resolution, async face‑detection avec fallback MANUAL_REVIEW).
- F2 Audit log immuable + 9 auto‑flags + duplicate detection.
- F3 Dual‑driver resilience (`ritual_aggregate` table régulière, fallback memoryStore).
- R1 [M] Hard‑coded `['pack-femiglow']` dans cron aggregate.
- R2 [L] Honeypot seul, pas de captcha → bot coordonné peut tester sans détection.
- R3 [M] Vision‑ML safe‑manual sature potentiellement la file modération si 5+ rituels/jour × 4 photos chacun.
- Reco 1 Externaliser product keys aggregate vers `app_config` (2 h).
- Reco 2 Tracker `photo_pending_count` dans `ritual_aggregate` + alerter > seuil (3 h).
- Reco 3 Brancher mediaPipe en staging derrière flag (8 h).

---

## S5. CMS DB‑driven (Components, SEO)

### Backend

[migrations/0005_components_cms.sql](../../apps/web/drizzle/migrations/0005_components_cms.sql) implémente le contrat :

- Table `component_field_bindings` : `(component_id, field_key, locale, status ∈ {draft, published, scheduled, archived})`, unicité par état draft/published, CHECK `cfb_scheduled_requires_scheduled_at`.
- Table `component_field_history` : insert‑only avec `field_history_action` ENUM (`CREATE|UPDATE|PUBLISH|RESTORE|SCHEDULE|...`), snapshot `value` JSONB.

Optimistic locking : header `If-Match` sur PATCH champ, mismatch → `ConflictError` 409.

Cron promote (`/api/admin/components/cron/promote-now` ou `/api/cron/promote-scheduled-fields`) boucle sur `listScheduledDue()`, appelle `publishBinding()`, log audit, invalide `revalidateTag('components:fields:${key}:${locale}')`. Fire‑and‑forget par binding (échec d'un ne bloque pas les autres).

### Frontend

L'admin Components offre éditeur de champ, history, restore, publish, schedule, animations, bindings bulk. `/admin/components/[key]/preview` est en iframe (CSP `frame-ancestors 'self'` ciblé).

### UI/UX admin

`AdminShell` cohérent. Bonus dette : pas de loader/skeleton sur les pages d'admin lourdes.

### Ergonomie

Versioning + scheduling = pouvoir réel mais courbe d'apprentissage. Restore d'une valeur dont le validateur a changé : pas d'avertissement, l'admin republie un champ qui peut être obsolète.

### Forces / risques / recos

- F1 Audit intrinsèque via `component_field_history`.
- F2 Optimistic locking If‑Match → pas de lost update.
- F3 Cache invalidation ciblée par tag locale.
- R1 [M] `component_field_history` croît sans purge garantie ; `/api/cron/purge-field-history/` à valider.
- R2 [M] Validateurs métier non versionnés.
- R3 [L] Snapshot promote = micro‑race entre cron et annulation admin.
- Reco 1 Cron purge `WHERE createdAt < NOW() - INTERVAL '1 year'` quotidien (1 h).
- Reco 2 Ajouter `field_validation_schema_version` au binding (4 h).
- Reco 3 Bouton « Nettoyer archive » admin (2 h).

---

## S6. Admin / back‑office

### Backend

- Session iron‑session, cookie scellé, TTL 8 h, payload `{adminId, email, issuedAt, expiresAt}`. Pas de table session côté DB → redeploy transparent.
- Login `POST /api/admin/login` : rate‑limit IP+email (5 fails/15 min), argon2 (`@node-rs/argon2`, time=2, mem=19.5 KB, par=1), audit `admin.login.success|failed` avec IP hashée.
- CSP/HSTS/X‑Frame déjà couverts cross‑cutting.
- Pas de CSRF middleware explicite ; SameSite=Lax + form-action 'self' compense.

40+ routes admin couvrent components, SEO, products, seeders, media, leads, webhooks, tracking, chat, analytics. Toutes appellent `requireAdminApi()` qui throw `HttpError 401` si pas de session.

### Frontend

Pages RSC `await requireAdmin()` + `AdminShell` ; clients hydratés pour formulaires/uploads/modales. Séparation propre.

### UI/UX admin

Cohérent. Manque tests unitaires composants admin visibles.

### Sécurité

- **R1 [H] RBAC seedé non appliqué**. Page `/admin/settings/rbac/`, `rbacSeeder` dans registry, **aucune route ne vérifie de matrice de permissions**. Tout admin = full power. Critique pour multi‑opérateur.
- **R2 [M] Pas de 2FA**. Compromission email/password = accès complet pricing, leads, seeders.
- **R3 [M] `ADMIN_SESSION_PASSWORD` rotation = invalidation toutes sessions**.

### Recos

- Reco 1 Middleware `enforcePermission(action, resource)` avant `requireAdminApi()` (8 h, H).
- Reco 2 TOTP 2FA via `otplib`, backup codes en DB (6 h, M).
- Reco 3 Rate‑limit par `adminId` en plus de IP (2 h, M).

---

## S7. Seeders & bootstrap

### Backend

16 seeders organisés en registry (`lib/seeders/registry.ts`) sur 5 catégories : core (app_config nav/flags/rbac/branding), commerce (products, delivery-cities, stock), content (components, SEO, media), chat (providers, instructions, rate-limits), tracking, rituals. Tous marqués `idempotent: true`.

Orchestrateur séquentiel : `POST /api/admin/seeders/run` crée `JobInternal` in‑memory, lance `runJob({jobId, selected, actorId})` fire‑and‑forget, retourne 202. Client subscribe `GET /api/admin/seeders/jobs/[jobId]/stream` SSE. Buffer 500 events, TTL 1 h.

Idempotence garantie selon le pattern par seeder :
- `app_config` : `upsertAppConfig(…, expectedVersion)` → no‑op si checksum identique.
- `products` : trouve/crée par slug, PATCH variants, upsert SEO override.
- `delivery-cities` : scan Sendit API, INSERT/IGNORE + UPDATE sauf `source='sendit'` (les villes édités manuellement par admin protégées).
- `components` : scan `docs/` pour récupérer schémas + animations.

Cancel : `POST /api/admin/seeders/jobs/[jobId]/cancel` signale via `AbortController`. Seeders respectent `ctx.signal.aborted` periodiquement (pas force‑kill).

Bootstrap admin : `ensureBootstrapAdminOnce()` (lib/auth/bootstrap-admin.ts) crée un admin par défaut depuis `ADMIN_BOOTSTRAP_EMAIL`/`PASSWORD`/`NAME` si la table est vide.

### Forces / risques / recos

- F1 Séquentialité + idempotence + audit par seeder.
- F2 SSE event stream user‑friendly.
- F3 `delivery-cities` respecte les edits manuels.
- R1 [M] Jobs en RAM, pas de persistence. Restart serveur = histoire perdue.
- R2 [M] Pas de transaction au niveau du job ; A OK / B fail / C run → BD hybride.
- R3 [L] Buffer 500 events, seeder verbeux perd ses premiers events.
- Reco 1 Table `seeder_jobs` JSONB events (8 h, M).
- Reco 2 Savepoint par seeder pour rollback partiel (6 h, M).
- Reco 3 Cursor pagination history events (3 h, L).

---

## S8. Webhooks outbound + cron

### Backend

[lib/webhooks/outbound/dispatcher.ts](../../apps/web/src/lib/webhooks/outbound/dispatcher.ts) :

- Validation Zod `outboundPayloadSchema` (`OutboundPayloadValidationError`).
- HMAC‑SHA‑256 + `crypto.timingSafeEqual()`, header `x-femiglow-signature: sha256=<hex>`.
- Idempotence `<source>:<sourceId>` avec court‑circuit `status='sent'`.
- Retry exponentiel 3 tentatives [1 s, 3 s, 9 s], `fetch` timeout 8 s.
- Logging audit final (sent/failed/skipped/disabled).

Payload PLAT ([payload.ts](../../apps/web/src/lib/webhooks/outbound/payload.ts)) : `{id, full_name, phone (E.164 ou 0+national), …}` ; strip `null|undefined` (rejet CRM des champs ambigus).

Sources :
- `from-order.ts` : compose product_name, address, notes shipping/payment.
- `from-cart-abandon.ts` : scanner `chat_lead` filtre [30 min, 7 j], anti‑doublon `abandonWebhookAt`, limite 50/scan.
- `from-contact.ts`, `from-chat-lead.ts` : phone‑gate systématique.

Cron tick [/api/cron/tick/route.ts](../../apps/web/src/app/api/cron/tick/route.ts) :
- Auth Bearer `CRON_SECRET` strict.
- Séquence cart‑abandon (limit 30) avant legacy batch (limit 50).
- Budget temps 50 s.

Migration 0026 ajoute table `outbound_webhook_log`.

### Forces / risques / recos

- F1 HMAC + timing‑safe + retry exponentiel + idempotence + audit.
- F2 Cron budget temps explicite.
- F3 Phone normalize E.164/0+national selon pays.
- R1 [M] Idempotency‑key collision possible si plusieurs sources émettent même `sourceId` pour types différents. Ajouter `eventName` à la clé.
- R2 [M] Fire‑and‑forget dispatch côté route : si la route order et le cron rentrent en même temps, doublon potentiel.
- R3 [L] `abandonWebhookAt` stampé APRÈS dispatch → crash entre les deux = rejoue (mais idempotent côté receveur).
- Reco 1 Clé composite `(source, sourceId, eventName)` (2 h).
- Reco 2 Test E2E double trip order+cart-abandon simultanés (3 h).
- Reco 3 Métrique `outbound.fail_rate` dans dashboard admin (2 h).

---

## S9. Tracking + analytics (GA4 + GTM)

### Backend

`/api/track` ([app/api/track/route.ts](../../apps/web/src/app/api/track/route.ts)) :
- Ingest batch 50 events max, schema Zod strict, validation 3 niveaux (JSON shape, params event‑specific, consent+dedup).
- Provider dispatch via `Promise.allSettled` (isolation des pannes).
- IP hashée dans logs.

Datalayer client ([lib/tracking/datalayer.ts](../../apps/web/src/lib/tracking/datalayer.ts)) : buffer 200 entries FIFO, dual push `femiglowDataLayer` + `window.dataLayer`.

Consent ([lib/tracking/consent.ts](../../apps/web/src/lib/tracking/consent.ts)) : localStorage + cookie SameSite=Lax + CustomEvent `fg:consent-changed`. Default DENIED.

`ConsentBanner` : `role=dialog`, ARIA labels, 5 catégories de consentement, accept‑all/deny‑all.

GTM container versionné ([lib/tracking/gtm/config-store.ts](../../apps/web/src/lib/tracking/gtm/config-store.ts)) : CRUD JSONB sur `tracking_settings`, versions UUID, FIFO drop au‑delà de `MAX_CONFIG_VERSIONS`. Activation last‑write‑wins.

GTM provider ([lib/tracking/providers/gtm.ts](../../apps/web/src/lib/tracking/providers/gtm.ts)) : adapter `clientSnippet()` injecte `pixelId` dans le snippet par concaténation. **Risque [H] XSS** confirmé.

Migrations 0002, 0003, 0009, 0010, 0011, 0015 (insights init, columns, matviews, AB tests). Cron `/api/cron/analytics-refresh` et `/api/cron/tracking-purge`.

### Forces / risques / recos

- F1 Zod strict + 3 niveaux validation.
- F2 Provider isolation via `allSettled`.
- F3 Audit IP hashée.
- R1 [H] **GTM pixelId concaténé sans schéma → XSS**.
- R2 [M] EventID dedup in‑memory → replay possible après restart.
- R3 [M] GTM config last‑write‑wins → perte silencieuse 2 admins simultanés.
- Reco 1 Regex `^(G-|GTM-|UA-)[A-Z0-9-]+$` + escape sur pixelId (30 min).
- Reco 2 Persister dedup eventID 1 h en DB ou Redis (3 h).
- Reco 3 Optimistic lock GTM config (`version` column) (4 h).

---

## S10. Media (upload, transform, OG)

### Backend

Migration [0001_media.sql](../../apps/web/drizzle/migrations/0001_media.sql) pose `media`, `media_jobs`, `media_variants`, `media_usages`, `media_tags`. Enums kind/source/status, soft‑delete via `deleted_at`, FK cascade jobs/variants/usages.

Storage pluggable :
- `local` : filesystem `./.media-storage`.
- `vercelBlob` ([storage/vercel-blob.ts](../../apps/web/src/lib/media/storage/vercel-blob.ts)) `addRandomSuffix: false` (clé déterministe publique).
- `external` : URL proxy, testé partiellement.

Validation ([lib/media/validate.ts](../../apps/web/src/lib/media/validate.ts)) : MIME via `file-type/Buffer`, SVG cas spécial XML, size vs `MEDIA_MAX_BYTES` (50 MB par défaut). Rejets : `too_large`, `mime_mismatch`, `unsupported`, `corrupt`.

Cron `/api/cron/media-optimize` et `/api/cron/media-recover` (Bearer CRON_SECRET, budget 50 s, loop `runWorkerOnce()`).

### Sécurité

- **R1 [H] Signed URLs non implémentés**. `MEDIA_SIGNED_URL_SECRET` validé `min(32)` dans env mais aucun usage trouvé. Blob URL publique.
- **R2 [H] Mass upload abuse**. Pas de rate‑limit visible sur `/api/admin/media/route.ts` upload. 50 MB × 1000 = 50 GB de coût Vercel Blob possible.
- **R3 [M] SVG XML non sanitizé**. Détection par prefix `<svg` mais pas DOMPurify SSR ; si rendu inline, XSS.

### Forces / risques / recos

- F1 MIME detect binary + size limit + soft‑delete.
- F2 Cron optimize + recover + audit.
- F3 Storage pluggable, blob/local prêts.
- R1 [H] Signed URLs absents.
- R2 [H] Mass upload.
- R3 [M] SVG XSS potentiel.
- Reco 1 Middleware HMAC `?sig=…&exp=…` sur `/api/media/[id]` (3 h).
- Reco 2 Rate‑limit IP+admin 10/h sur upload (2 h).
- Reco 3 DOMPurify SSR + interdiction SVG si rendu inline (2 h).

---

## S11. Newsletter + contact + i18n

### Backend

- [/api/newsletter/route.ts](../../apps/web/src/app/api/newsletter/route.ts) : Zod `newsletterSchema` (email RFC + consent literal true + source), honeypot `website`, log `logger.info('newsletter.subscription.received')`. **Pas de rate‑limit** [risque H].
- [/api/contact/route.ts](../../apps/web/src/app/api/contact/route.ts) : Zod `contactFormSchema` (`lib/schemas/contact.ts`) avec `superRefine` (type=order → orderNumber requis, type=professional → phone+companyName+role requis). Honeypot. **Pas de rate‑limit**, **phone non normalisé** alors que `lib/phone.ts` existe.

### i18n

[lib/i18n/categories.ts](../../apps/web/src/lib/i18n/categories.ts) : stub minimal catégories éditoriales FR. Phase 2 = Sanity + ar/ar‑MA.

### Phone

[lib/phone.ts](../../apps/web/src/lib/phone.ts) : parser maison ciblant MA (95 % trafic) + FR/BE/CH/DZ/TN. Trunk prefix strip, validation longueurs/préfixes mobile/fixe. Bonne couverture pour le périmètre, commentaire annonce migration `libphonenumber-js` triviale si élargissement. Non câblé en route contact.

### Rate‑limit

[lib/rate-limit/check.ts](../../apps/web/src/lib/rate-limit/check.ts) : token bucket in‑memory simple. API `checkRateLimit({key, limit, windowMs})`. Pas de persistence, pas de Redis. Newsletter+contact ne l'invoquent pas.

### Forces / risques / recos

- F1 Validation Zod stricte FR + honeypot.
- F2 Phone parser robuste pour le périmètre.
- F3 Module rate‑limit prêt à brancher.
- R1 [H] Spam trivial newsletter/contact.
- R2 [M] Phone non normalisé en contact, phone‑gate webhook commenté CHA‑260 mais à vérifier.
- R3 [M] Email contact hardcodé `info@femiglow-maroc.com`, pas en env.
- Reco 1 Brancher `checkRateLimit({key:'ip:'+ip+':'+email, limit:3, windowMs:3600_000})` (30 min).
- Reco 2 `parsePhone(data.phone)` côté route + ajouter validation (1 h).
- Reco 3 `CONTACT_EMAIL` en env + `config/contact.ts` (30 min).

---

## S12. Audit log + observabilité

### Backend

[lib/logging/logger.ts](../../apps/web/src/lib/logging/logger.ts) : 4 niveaux (debug/info/warn/error), `LOG_LEVEL` env filter, AsyncLocalStorage context (`request_id`, `admin_id`, `route`, `ip_hash`), redaction PII 50+ keys, JSON stdout.

[lib/audit/log-event.ts](../../apps/web/src/lib/audit/log-event.ts) : insert DB Drizzle + log JSON, ID via `createId('ae')`, fallback memoryStore. Couvre actions composants/media/login ; pas systématique sur leads/contact/newsletter.

[lib/http/client-ip.ts](../../apps/web/src/lib/http/client-ip.ts) : extraction `x-forwarded-for`/`x-real-ip` puis SHA256 slice 16 → `ip_hash` privacy‑safe.

[lib/errors/http-error.ts](../../apps/web/src/lib/errors/http-error.ts) : déjà couvert cross‑cutting.

[/api/health/route.ts](../../apps/web/src/app/api/health/route.ts) : retourne `{status:'ok'}` sans ping DB. Edge runtime, `force-dynamic`.

Admin audit UI (`/admin/audit`) : filtre `resourceType`, table {timestamp Paris TZ, action, actor, target, meta JSON pretty}.

### Forces / risques / recos

- F1 Redaction PII automatique 50+ keys.
- F2 `HttpError` + `formatErrorResponse` typed.
- F3 Admin audit lisible + drill‑down meta.
- R1 [H] Logs stdout‑only → perdus si pas Vercel/Datadog.
- R2 [M] Health endpoint sans dépendance check → faux positif.
- R3 [M] Meta audit JSON non schemé → migrations risquées.
- Reco 1 Shipping Vercel logs ou Datadog (1 h config).
- Reco 2 Health `{db:'ok|error', timestamp}` avec optional db ping (30 min).
- Reco 3 `auditEventSchema` Zod par action type (2 h).

---

## S13. Marketing pages

### Architecture pages

| Page | Route | Stratégie cache | État |
|---|---|---|---|
| Home | `/` | ISR `revalidate=3600` | wired CMS data |
| Rituel | `/rituel` | ISR | wired CMS data |
| Maison | `/maison` | ISR | wired CMS data |
| Journal | `/journal?category=*` | ISR 1800 | wired pagination cursor |
| Article | `/journal/[slug]` | SSG + ISR | wired (comment form stub) |
| Contact | `/contact` | SSG | wired |
| Kit | `/kit` | ISR | feed produit + commander inline |
| Panier | `/panier` | dynamic | wired commerce |
| Merci | `/merci` | dynamic no‑cache | wired |
| FAQ | inline contact | — | inline |

### UI atoms

[components/ui/Heading.tsx](../../apps/web/src/components/ui/Heading.tsx) : `as`, `size`, `tone (default|soft|on-dark)`, `italic (never|auto|always)`, `balance`. Display Cormorant `text-wrap:balance`.

[components/ui/Kicker.tsx](../../apps/web/src/components/ui/Kicker.tsx) : 11 px, 0.18em tracking, tones encre/creme/champagne/sauge, optional rule.

[components/ui/Text.tsx](../../apps/web/src/components/ui/Text.tsx) : lead/body/small/caption × default/secondary/tertiary/on-dark, prose mode, italic, balance.

[components/ui/Container.tsx](../../apps/web/src/components/ui/Container.tsx) : prose/content/wide/page widths, padding responsive 5/8/12.

[tailwind.config.ts](../../apps/web/tailwind.config.ts) : palette tokens CSS `--color-*` (creme, encre, sauge, petale, ciel, champagne) × variants (default, soft, dark) ; font scales `display-2xl` clamp(64‑128 px) → caption 11 px uppercase tracking.

### Sections

Hero : grid 6fr text / 5fr image lg, Kicker champagne, Heading display‑xl never italic, HeroDecoration SVG (sauge‑dark + champagne‑dark, opacity 18 %) pur CSS.
GestesGrid : `<ol>` semantic, 5 cols lg → 1 col mobile, step numbers opacity 25 fade on hover, Reveal stagger 60ms.
Manifeste : sauge‑soft bg, title display‑md italic, lead italic display family.
AvisStrip : 5 cols lg (test|fleuron|test|fleuron|test), TestimonialCard bind images.
NewsletterBlock : grid 2 cols md, dynamic NewsletterForm `ssr:false` + placeholder pulse.

### Accessibilité

Header [components/layout/Header.tsx](../../apps/web/src/components/layout/Header.tsx) : `<header role="banner">` sticky, `tabIndex={-1}` cible skip‑link (manque le `<a>` visible). Menu : `aria-expanded`, `aria-controls`, `aria-haspopup="dialog"`. `aria-hidden={chatOpen}` masque header au lecteur écran quand chat ouvert.
Footer : `<footer role="contentinfo">`, 4× `<nav aria-label="...">`.
Contact page : `<h2 id="contact-form-heading">` + `aria-labelledby` sur la section ✓.

### Voix

« Deux gestes, un polissoir, cinq minutes par soir » constant home/rituel/contact. Contact : « La maison vous répond sous 24 heures ouvrées ». FAQ : « La maison conseille un passage par jour ». Pas de superlatif.

Incohérence à vérifier : home parle parfois de « deux gestes » et rituel de « quatre gestes » selon la migration depuis le seed initial. À aligner.

### Forces / risques / recos

- F1 Atoms (Container/Heading/Kicker/Text) cohérents et appliqués partout.
- F2 Pages fully wired CMS bind (`Bound` components) → Phase 2 Sanity swap facile.
- F3 Mobile‑first, ISR, dynamic imports, semantic.
- R1 [M] Skip‑link non visible (cible OK, anchor invisible).
- R2 [M] FAQ `<details>` natif sans aria-expanded/controls fin.
- R3 [M] Incohérence narrative `2 gestes` (home) vs `4 gestes` (rituel) à vérifier.
- Reco 1 `<a href="#main" className="sr-only focus:not-sr-only">Aller au contenu</a>` (30 min).
- Reco 2 Convertir FAQ en `<Disclosure>` Radix (2 h).
- Reco 3 Single source of truth `lib/copy/key-phrases.ts` (1 h).

---

## Z. Annexes

### Z.1 Tableau récapitulatif service × axe × score (sur 5) × top reco

| Service | Backend | Frontend | UI | UX | Design | A11y | Fonct. | Top reco |
|---|---|---|---|---|---|---|---|---|
| S1 Catalogue | 4 | 4 | 4 | 3.5 | 4.5 | 3 | 4 | Externaliser feed copy CMS |
| S2 Checkout | 4 | 3.5 | 4 | 4 | 4 | 3.5 | 4 | Rate‑limit lead + stock CAS test |
| S3 Chat | 4 | 4 | 4 | 4 | 4 | 3 | 3 | Redis buckets + cap budget |
| S4 Rituels | 4.5 | 4 | 4 | 4 | 4.5 | 4 | 4 | Externaliser product_keys aggregate |
| S5 CMS | 4 | 3.5 | 3.5 | 3 | 3 | 3 | 4 | Purge history + validator versioning |
| S6 Admin | 3.5 | 3.5 | 3.5 | 3 | 3 | 3 | 3.5 | RBAC enforcement + 2FA |
| S7 Seeders | 3.5 | 3 | 3 | 3.5 | 3 | 3 | 3.5 | Persister jobs + savepoint |
| S8 Webhooks | 4.5 | — | — | — | — | — | 4 | Clé composite + test concurrent |
| S9 Tracking | 3 | 3.5 | 3.5 | 3 | 3 | 4 | 3.5 | Schéma Zod pixelId |
| S10 Media | 3 | — | 3 | 3 | 3 | 3 | 3 | Signed URLs + rate‑limit upload |
| S11 Newsletter | 3 | 3.5 | 4 | 3.5 | 4.5 | 3.5 | 3.5 | Rate‑limit + phone normalize |
| S12 Audit | 4 | 3.5 | 4 | 3.5 | 3 | 3.5 | 3.5 | Log shipping + health DB |
| S13 Marketing | — | 4 | 4.5 | 4 | 4.5 | 3.5 | 4 | Skip‑link visible + Disclosure |

### Z.2 Fichiers les plus chargés en dette

| Fichier | Raison |
|---|---|
| [lib/tracking/providers/gtm.ts](../../apps/web/src/lib/tracking/providers/gtm.ts) | `pixelId` concaténé brut → XSS [H] |
| [lib/checkout/repos/stock-repo.ts](../../apps/web/src/lib/checkout/repos/stock-repo.ts) | CAS atomicity non confirmée [H] sous concurrence |
| [api/checkout/lead/route.ts](../../apps/web/src/app/api/checkout/lead/route.ts) | Pas de rate‑limit, ouvert aux bots [H] |
| [api/newsletter/route.ts](../../apps/web/src/app/api/newsletter/route.ts) | Pas de rate‑limit [H] |
| [api/contact/route.ts](../../apps/web/src/app/api/contact/route.ts) | Pas de rate‑limit + phone non normalisé [M] |
| [api/admin/media/route.ts](../../apps/web/src/app/api/admin/media/route.ts) | Mass upload + signed URL absents [H] |
| [lib/tracking/gtm/config-store.ts](../../apps/web/src/lib/tracking/gtm/config-store.ts) | last‑write‑wins sur activate [M] |
| [lib/seeders/job-store.ts](../../apps/web/src/lib/seeders/) | RAM only, perte au restart [M] |
| [lib/i18n/categories.ts](../../apps/web/src/lib/i18n/categories.ts) | Stub minimal vs ambition Phase 2 [L] |
| [api/health/route.ts](../../apps/web/src/app/api/health/route.ts) | Health sans dépendance [M] |
| [lib/cms/](../../apps/web/src/lib/cms/) (adapter Sanity) | env `CMS_PROVIDER='sanity'` typé mais non implémenté [L] |
| [docs/preparation/07-modeles-donnees-api.md](../preparation/07-modeles-donnees-api.md) | Désync code (priceCents, payment 3 modes, FG‑YYYY‑NNNNN, 160+ routes) [M] |

### Z.3 Glossaire des termes maison

- **Pack FemiGlow** : produit unique (paste + powder + polissoir), vendu 199 dh promo / 390 dh anchoring (commit `88c5c1e`).
- **Kit** : synonyme commercial du Pack ; URL `/kit`.
- **Anchoring** : prix de référence barré (390 dh) servant de point d'ancrage psychologique pour le prix réel (199 dh). Cf. Kolenda Pricing.
- **Kolenda** : référentiel copywriting/pricing/ecom/luxury appliqué à FemiGlow ; principes #1 (présent), #14 (precise digits), #21 (first step complete), #29 (social proof condensé), #34 (framing impact). Voir `docs/kolenda/`.
- **CHA‑XXX** : ticket interne (CHA‑225 chat‑lead webhook upgrade, CHA‑231 Commander unifié, CHA‑243 YouTube nocookie embed, CHA‑260 webhook outbound unifié).
- **Phone‑gate** : règle CHA‑260 qui exige un téléphone normalisé E.164/0+national avant d'émettre un webhook lead vers le CRM.
- **Webhook PLAT** : format de payload outbound aplati (pas de nesting), `{id, full_name, phone, …}`, signé HMAC‑SHA‑256 header `x-femiglow-signature`.
- **Wall reviews** = **rituels** : galerie publique de témoignages clients avec photos modérées, signal recommandation `oui|hésite|non`. Cf. `lib/rituals/`.
- **Cron tick** : job récurrent `/api/cron/tick` qui orchestre cart‑abandon scan puis webhook batch, budget temps 50 s, auth Bearer `CRON_SECRET`.
- **Seeder** : script idempotent enregistré dans `lib/seeders/registry.ts`, exécutable via UI admin `/admin/settings/seeders/`.
- **Form‑config** : config versionnée des formulaires (checkout, contact, newsletter) avec history et rollback, table dédiée migration 0018.
- **MemoryStore** : `globalThis.__femiglowStore` fallback DB pour tests vitest et dev sans Postgres ([lib/db/client.ts:155](../../apps/web/src/lib/db/client.ts)).
- **Dual‑driver** : pattern Drizzle où `db()` retourne soit Neon HTTP, soit postgres‑js, soit `null` (→ retombe sur memoryStore).
- **Idempotence checkout** : table `checkout_idempotency` (key+scope+hash+response+TTL 24 h), middleware `withIdempotency`.
- **AdminShell** : layout admin commun, sidebar nav, link actif via `usePathname`.
- **Live preview admin** : iframe sur `/admin/components/[key]/preview/` avec `frame-ancestors 'self'` ciblé (middleware.ts:115).
- **Charte FemiGlow** : palette `creme/encre/sauge/petale/ciel/champagne` × 3 variants chacune, fonts `Cormorant` display + `Inter` body + `Pinyon Script`, voix sensorielle sans superlatif/urgence/countdown.

---

*Audit complété le 2026-05-13 par exploration multi‑agents et synthèse tech‑lead. Aucun fichier source modifié. Les mentions « À vérifier » signalent les hypothèses non confirmées par lecture directe — à clore avant tout déploiement production.*
