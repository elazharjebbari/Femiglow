# 02 — Fondations techniques

Stack et **patterns réutilisables**. Une feature qui respecte ces conventions est cohérente,
testable et maintenable sans effort supplémentaire.

---

## 1. Stack

| Couche | Techno |
|---|---|
| Framework | Next.js 14 App Router (RSC) |
| Langage | TypeScript strict (ESM) — `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` |
| ORM / DB | Drizzle ORM + PostgreSQL (Neon serverless) |
| Auth | iron-session (chiffrée) + Argon2id |
| Validation | Zod (systématique sur les payloads) |
| État client | Zustand · Forms : React Hook Form + Zod resolver |
| Animations | Framer Motion |
| i18n | next-intl (`messages/{fr,ar,en}.json`, middleware `[locale]`) |
| Chat IA | adapters maison multi-provider (LangChain en partie) |
| State partagé | Redis (Upstash-compatible) : dédup, breaker, idempotency |
| Mail | Nodemailer → Stalwart · Listmonk (campagnes) |
| Tests | Vitest + Testing Library (unit) · Playwright + axe-core (e2e) · MSW (mocks réseau) |
| Build / CI | pnpm workspaces · GitHub Actions (lint, typecheck, test, lighthouse, security) |
| Déploiement | Vercel (crons dans `vercel.json`) |

Taille (2026-05-30) : 2 640 fichiers `.ts/.tsx`, 343 route handlers, 141 pages admin,
76 migrations Drizzle, ≈787 fichiers de tests unitaires, 95 specs e2e. `pnpm typecheck` = vert.

---

## 2. Patterns à réutiliser

### 2.1 Route API
- Handler `route.ts` sous `app/api/...`. Valider l'entrée avec **Zod**, retourner des erreurs
  typées (`lib/errors`, `lib/http`).
- Mutation sensible → middleware `withIdempotency` (clé déterministe) + transaction Drizzle.
- Route longue/SSE → `export const maxDuration = N` (leçon live-systems).
- Route publique → **rate-limit obligatoire** (`lib/rate-limit` ou `lib/redis`).

### 2.2 Idempotence & état partagé
- Mutations commerce : `withIdempotency` (déjà sur lead/order/address/payment).
- Dédup d'événements, circuit breakers, idempotency keys cross-lambda :
  `lib/redis/{dedup,circuit-breaker,idempotency}` avec **fallback mémoire** si Redis indisponible.
- Stock : réservation CAS (compare-and-swap).

### 2.3 Composant de présentation « dual-mode » (i18n-safe)
Un composant `'use client'` ou serveur « dumb » **n'appelle jamais** `getTranslations`. Il reçoit
ses strings en props avec un **défaut FR**, résolus par un wrapper `*Bound` (server, `async`) :

```tsx
interface Props { header?: { kicker: string; title: string } }
const DEFAULT_HEADER = { kicker: 'Questions', title: '…' };
export function Section({ header = DEFAULT_HEADER }: Props) { /* {header.kicker} */ }
```

Bénéfices : testable sans contexte i18n, rétro-compatible, zéro flash de langue. C'est
l'invariant central de la Phase 8 (cf. `i18n-strategy-2026-05/PHASE-8-FINITION-100PCT.md §2`).

### 2.4 Sources de vérité du contenu (ne jamais dupliquer)
| Nature | Source |
|---|---|
| Chrome UI (CTA, labels, en-têtes) | `messages/{locale}.json` via `getTranslations` |
| Contenu éditorial dynamique | CMS / mocks locale-aware via `cms.get*({ locale })` |
| Données seedées (témoignages, reviews) | DB + seed locale-aware |
| Override éditeur | `component_field_bindings` (colonne `locale`) |

### 2.5 Tracking d'un événement
- Client : `POST /api/track` (batch, consent-gated, dédupé).
- SSR : `serverFire()` (dispatch + persiste désormais en `tracking_events_log`).
- Webhook : `serverEmit()`.
- Tout nouvel événement doit être **déclaré dans le plan de tracking** (versionné en base) et
  mappé par provider (taxonomy unifiée `attribution-fix`).

### 2.6 Feature flags
`lib/feature-flags/*` (pattern `attribution`, `kit-layout`, `live-systems`). Toute feature à
risque (revenu, prod) se déploie **derrière un flag** activable par env var, pour un rollout
Canary → Ramp → Full et un rollback < 60 s.

### 2.7 Seed & données
- Scripts `scripts/seed-*.ts`, orchestrés par `pnpm seed:all` (et `seed:i18n-bindings`,
  `seed:rituals`, `seed:components`, `seed:seo`, `seed:products`…).
- **Idempotents** et **locale-aware** : le seed est le mécanisme de déploiement du contenu en
  prod (les mocks `*.ar.ts`/`*.en.ts` ne servent qu'au dev local). Parité mocks ↔ seed exigée.

### 2.8 Tests
- Unitaire : co-localisé `*.test.ts(x)`, Vitest. Mock réseau via **MSW**.
- e2e : `apps/web/e2e/*.spec.ts`, Playwright + axe (a11y) ; tags `@i18n`, `@live-*`.
- Parité catalogues i18n : `messages-parity.test.ts`. Scanner FR : `pnpm i18n:scan-fr`.

---

## 3. Garde-fous déjà en place

- Husky pre-commit : **gitleaks** + **migration validator** + lint-staged.
- CI : lint + typecheck + Vitest + Lighthouse (a11y exigé à 1.0) + security.
- `robots.txt` bloque les crawlers IA (GPTBot, CCBot, ClaudeBot).
- HMAC sur webhooks entrants/sortants ; secrets chiffrés AES-256-GCM en base.
- Consent Mode v2 (defaults `denied`) ; CSP active.

## 4. Manques d'outillage à connaître

- **Pas de Sentry/APM** ni de métriques exportées (Prometheus/OTel) — observabilité limitée aux
  logs et aux dashboards `/admin/live-health`.
- **Pas de branch protection** visible sur `master`, pas de hook `commit-msg` (Conventional
  Commits non *enforced*).
- **Pas de queue durable** (BullMQ/pg-boss) : les retries différés reposent sur des crons.
- Rate-limit historique en DB (token bucket) ; migration vers Redis amorcée mais pas généralisée.
