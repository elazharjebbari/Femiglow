# 01 — Architecture & stack

> **Vue d'ensemble** : monorepo pnpm avec une seule app `apps/web` (Next.js 14 App Router), Drizzle ORM sur Postgres (Neon), iron-session pour l'admin, LLM multi-providers pour le chat, e-mail Stalwart + Listmonk, hébergement VPS LiteSpeed + cron jobs HTTP. Stack moderne, choix cohérents avec un produit B2C marocain à conversion forte (paiement à la livraison, chat IA, tracking lourd).

---

## 1. Topologie du repo

```
/var/www/femiglow/
├── apps/
│   └── web/                     ← seul package applicatif
│       ├── src/
│       │   ├── app/             ← App Router (45 787 LOC, 496 fichiers)
│       │   │   ├── (marketing)/
│       │   │   ├── (commerce)/
│       │   │   ├── admin/
│       │   │   ├── api/         ← 279 routes
│       │   │   ├── legal/
│       │   │   └── media-files/
│       │   ├── components/      ← 79 660 LOC, 627 fichiers
│       │   ├── lib/             ← 124 935 LOC, 853 fichiers
│       │   ├── styles/
│       │   └── middleware.ts
│       ├── drizzle/migrations/  ← 66 migrations SQL versionnées
│       ├── e2e/                 ← Playwright
│       ├── k6/                  ← load testing
│       ├── public/
│       ├── content/             ← MDX, articles
│       └── data/
├── docs/                        ← ≈ 280 .md, 80 k lignes (cf. doc 08)
├── infra/                       ← (récent, non commité)
├── scripts/
├── .github/workflows/           ← ci.yml, lighthouse.yml, security.yml
├── .husky/                      ← pre-commit
├── .gitleaks.toml
├── .lighthouserc.json
├── pnpm-workspace.yaml
└── package.json                 ← root
```

**Points-clés** :
- Un seul workspace (`@femiglow/web`) — pas de duplication. Décision saine pour un projet de cette taille (1 dev + 1 agent).
- `packages/` est vide → pas encore de modules partagés extraits. C'est tenable jusqu'à 2–3 apps.
- `infra/` et `scripts/` sont récents (commit `?? infra/`, status non commit). À surveiller — du Terraform / Ansible / docker-compose ?

---

## 2. Stack technique réelle

### 2.1 Framework et runtime
| Domaine | Choix | Version | Commentaire |
|---|---|---|---|
| Framework | Next.js | 14.2.15 | App Router, RSC, streaming SSE. `reactStrictMode: true`, `poweredByHeader: false`. |
| React | React | 18.3.1 | |
| Node | Node | ≥ 20 | déclaré dans `engines` |
| Package manager | pnpm | ≥ 9 | workspace, overrides (`jsdom@25.0.1`) |
| TypeScript | TS | strict | `target ES2022`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, paths `@/*` |
| Bundler | Next.js intégré | | pas de turbopack en prod |
| Hébergement | VPS bare-metal | srv983171 + LiteSpeed | systemd services `femiglow.service` (prod) + `femiglow-staging.service` |
| DB | Neon (Postgres managed) | postgres-js 3.4.4 | driver simple, pas de pgbouncer applicatif visible |

### 2.2 ORM, validation, formulaires
- **Drizzle ORM** `0.45.2` + **drizzle-kit** `0.31.10` — schémas TypeScript, migrations SQL générées, mode `strict: true` + `verbose: true`.
- **Zod** `3.23.8` — utilisé systématiquement sur tous les endpoints publics (`safeParse` + `zodErrorResponse`).
- **React Hook Form** `7.53.0` + **@hookform/resolvers** `3.9.0` — couplé à Zod côté client.

### 2.3 UI
- **Tailwind CSS** `3.4.13` + PostCSS + Autoprefixer.
- **Framer Motion** `11.11.0` (animations sélectionnées).
- **Recharts** `2.13.0` (dashboards admin).
- **cmdk** `1.1.1` (command palette).
- Pas de `shadcn/ui` ou Radix « out of the box » : `/components/ui/` contient des primitives maison (`Button`, `Text`, `Heading`, `Field`, `Stack`, `Container`, `Toast`, `ConfirmationModal`).

### 2.4 Auth, crypto
- **iron-session** `8.0.4` — cookie scellé AES-256-GCM, TTL 8 h, `httpOnly + sameSite=lax + secure (prod)`.
- **@node-rs/argon2** `2.0.2` — hash mot de passe admin (Argon2id, params OWASP-compliant).
- HMAC SHA-256 maison pour signature webhook (sortants ET entrants).
- AES-256-GCM (dérivation scrypt) pour chiffrer secrets webhooks en base.

### 2.5 IA / Chat
- LangChain + adapters Anthropic / OpenAI / Mistral / Google GenAI / Ollama.
- pgvector (1536 dim) pour RAG FAQ.
- Embeddings côté serveur, fallback `503` si provider indispo.

### 2.6 Email
- **nodemailer** `8.0.7` + **@react-email/components** `1.0.12` + Handlebars (templates).
- Stack mail externe : Stalwart (SMTP/IMAP) + Listmonk (newsletter), audit récent `docs/audit-stalwart-email.md`.

### 2.7 Médias
- **sharp** `0.34.5` (images), **ffmpeg-static** + **fluent-ffmpeg** (vidéo), **pdfjs-dist** / **mammoth** / **music-metadata** (RAG documents).

### 2.8 Sécurité / sanitisation
- **DOMPurify / isomorphic-dompurify**, **rehype-sanitize**, **remark-gfm**.
- **gitleaks** (pre-commit + workflow CI).

### 2.9 State management
- **Zustand** `5.0.0` (chat-store, cart, tracking) — léger, scopé.
- Pas de Redux, pas de React Query (cité comme dette dans `docs/AUDIT-2026-05.md`).

### 2.10 Tests
- **Vitest** + **MSW** (API mock) + **@testing-library/react**.
- **Playwright** pour e2e (`/e2e`, 59 specs).
- **k6** pour load tests (`/k6`).
- **axe-core** + **@axe-core/playwright** pour a11y automatisée (Lighthouse exige score 1.0).

---

## 3. Configuration clé

### 3.1 `next.config.mjs`
- `reactStrictMode: true`, `poweredByHeader: false`.
- `typescript.ignoreBuildErrors: false` — build cassé si TS errors, discipline forte.
- `serverComponentsExternalPackages: ['@node-rs/argon2', 'sharp', 'fluent-ffmpeg', 'ffmpeg-static', 'isomorphic-dompurify', 'jsdom']`.
- Images : `formats: ['image/avif', 'image/webp']`, `deviceSizes [360, 480, 720, 960, 1280, 1600, 1920]`, `minimumCacheTTL: 30j`, `dangerouslyAllowSVG: true` (⚠ risque XSS résiduel mitigé par CSP `script-src 'none'; sandbox`).
- `remotePatterns` strict : `cdn.sanity.io`, `images.femiglow.ma`, `*.public.blob.vercel-storage.com`.
- Redirects legacy : `/products/:slug → /kit`, `/blog/:slug → /journal/:slug`.
- Headers : cache immutable 1 an pour `/_next/static`, 1 jour + SWR 7 jours pour `/_next/image`.

### 3.2 `middleware.ts`
- **CSP dynamique** : nonce généré par requête, propagé via header `x-nonce`.
- Directives strictes : `default-src 'self'`, `object-src 'none'`, `frame-src` whitelist (youtube-nocookie, listmonk), `form-action 'self'`, `base-uri 'self'`, `frame-ancestors 'none'` (`'self'` pour preview).
- `'unsafe-inline'` sur `script-src` — limitation Next.js 14 RSC, à lever en migrant à Next 15 + `strict-dynamic`.
- HSTS implicite via `upgrade-insecure-requests` en prod.
- Auth admin : redirect `/admin/* → /admin/login` si pas de session valide.

### 3.3 `drizzle.config.ts`
- Dialecte Postgres, schémas multi-fichiers (`schema.ts`, `schema-emails.ts`, `schema-tracking-plan.ts`, `lib/chat/db/schema.ts`).
- Mode `strict: true` + `verbose: true`.
- 66 migrations SQL versionnées + journal `meta/_journal.json` synchronisé.

### 3.4 `vercel.json`
- 15 cron jobs : `/api/cron/tick` (toutes les minutes), purges tracking (daily 03:00 UTC), refresh analytics (15 min), crons chat (billing, intent, KB sync, budget, digest), cron legal (health check).
- **Note** : le projet n'est pas hébergé sur Vercel (VPS LiteSpeed), donc ces crons sont en réalité déclenchés via systemd timers ou wget HTTP — confirmer dans `infra/` quand le dossier sera commit.

### 3.5 `tsconfig.json`
- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`.
- Alias unique `@/* → src/*`, `skipLibCheck: true`, `isolatedModules: true`.

---

## 4. Organisation `src/`

### 4.1 `src/app/` — 496 fichiers, 45 787 LOC

| Groupe de routes | Rôle |
|---|---|
| `(marketing)` | landing, journal, contact, FAQ |
| `(commerce)` | kit produit, panier, commander |
| `admin/` | dashboard back-office (124 pages) |
| `api/` | 279 routes (cf. doc 02) |
| `legal/` | pages légales, rendues via markdown sanitizé |
| `media-files/` | proxy privé pour images protégées |
| `commander/`, `dev/` | utilitaires (dev only) |
| `sitemap.ts`, `robots.ts`, `error.tsx`, `not-found.tsx` | top-level |

### 4.2 `src/components/` — 627 fichiers, 79 660 LOC

| Dossier | Fichiers | Rôle |
|---|---|---|
| `admin/` | 317 | back-office (settings, tracking, products, SEO, emails, components) |
| `sections/` | 123 | sections éditoriales (Hero, Manifeste, GestesGrid, AvisStrip, JournalExtraits) |
| `commerce/` | 50 | cart, checkout (`CheckoutFlow` 625 LOC, à refactoriser) |
| `chat/` | 17 | chat widget + LeadFormBubble + chat-store Zustand |
| `checkout/` | 13 | wizard form steps + `CityAutocomplete` (498 LOC, excellent a11y) |
| `ui/` | 13 | primitives maison |
| `tracking/` | 13 | GTM, Snap, Consent, PixelLoader |
| `forms/` | 8 | ContactForm, NewsletterForm |
| `layout/` | 8 | Header, Footer, Navigation, SkipLink |
| `legal/` | 8 | |
| `patterns/`, `a11y/`, `icons/` | 7 | |

### 4.3 `src/lib/` — 853 fichiers, 124 935 LOC

Quelques sous-domaines clés (liste non exhaustive) :

| Dossier | Rôle |
|---|---|
| `admin/` | seeders, analytics, config |
| `auth/` | sessions iron-session, `requireAdminApi` |
| `checkout/` | repos (`order-repo` 263 LOC, `lead-repo`), schemas Zod, idempotency middleware |
| `chat/` | LLM orchestrator, RAG, repos, instructions, FAQ |
| `db/` | `schema.ts` (2 216 LOC, 75 tables), `schema-emails.ts` (17 tables), `schema-tracking-plan.ts`, types, queries |
| `mail/` | transactional (`send.ts`), templates Handlebars/React Email |
| `media/` | processing Sharp/FFmpeg |
| `tracking/` | CAPI Meta + Snap, GTM, plan tracking versionné, consent, attribution |
| `webhooks/` | engine, outbound sources (`from-order`, `from-chat-lead`, `from-contact`, `cart-abandon-scanner`) |
| `crypto/` | AES-256-GCM encryption (webhook secrets) |
| `logging/` | logger structuré JSON, PII redaction |
| `seo/` | resolve cascade (overrides DB → fallback → defaults), JSON-LD |
| `rate-limit/` | in-memory + DB |
| `errors/` | `HttpError` classe + `formatErrorResponse` |
| `env.ts` | typage centralisé env vars |

**Verdict architecture** :
- 🟢 Séparation `app` / `components` / `lib` propre.
- 🟢 Domaines métier bien isolés (`webhooks`, `tracking`, `chat`, `checkout`).
- 🟡 `lib/` est gros (124 k LOC), 853 fichiers → quelques sous-domaines mériteraient d'être extraits en packages internes (`@femiglow/tracking`, `@femiglow/chat`) si une 2ᵉ app arrive.
- 🟡 `components/admin/` (317 fichiers, ~50 % des composants) → candidate pour un split admin/public dans un futur où l'admin deviendrait une app séparée.

---

## 5. Patterns transverses

### 5.1 Validation
**Pattern dominant** :
```ts
const parsed = mySchema.safeParse(body);
if (!parsed.success) return zodErrorResponse(parsed.error);
```
- 100 % des routes publiques passent par Zod.
- Schemas réutilisables : `emailSchema`, `phoneMaroc9DigitsSchema`, `cartSnapshotSchema`.
- Consentement RGPD forcé en `z.literal(true)` (opt-in explicite — `lead.ts:48`).

### 5.2 Idempotence
**Pattern `withIdempotency`** sur les routes mutantes critiques :
```ts
await withIdempotency({
  request: req,
  scope: 'order_create',
  payload: parsed.data,
  execute: async () => { /* mutation atomique */ },
});
```
- Clé : header `Idempotency-Key` (UUID client).
- Table : `checkout_idempotency` (`scope, payload_hash, response_code, response_body, expires_at`).
- TTL : 15 min.

### 5.3 Erreurs
**Classe `HttpError`** centralisée :
```ts
type ErrorCode = 'unauthorized' | 'forbidden' | 'not_found' | 'invalid_input'
              | 'invalid_state' | 'rate_limited' | 'conflict' | ...
```
- Couverture ≈ 68 % des routes. Quelques routes adhoc retournent encore du JSON manuel — à harmoniser.

### 5.4 Cron auth
**Anti-pattern** observé 15 fois :
```ts
const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
if (!process.env.CRON_SECRET || auth !== expected) return 401;
```
→ candidat à extraction `requireCronSecret()` partagé (cf. doc `02-backend-api.md` §6).

### 5.5 Auth admin
**Pattern `requireAdminApi`** :
```ts
const auth = await requireAdminApi();
if (!auth.ok) return auth.response; // 401
```
- Toutes les routes `/api/admin/*` lues échantillonnent ce guard.
- Compléter par `requireSameOrigin(request)` pour CSRF defense-in-depth sur les mutations.

---

## 6. Forces de l'architecture

1. **Choix techno cohérents** : Next.js 14 + Drizzle + iron-session + Zod = le couple typesafe le plus solide actuellement.
2. **Convention de nommage stable** : alias `@/*`, fichiers en kebab-case pour les `lib/`, PascalCase pour les composants. Pas d'incohérences détectées.
3. **Séparation server/client claire** : `serverComponentsExternalPackages` configuré, RSC privilégié, `'use client'` minimal.
4. **Migrations versionnées + validateur strict** (`_validate-migrations.mjs` hash-based, `_check-migrations.ts` pre-commit). Pas de drift possible silencieusement.
5. **CSS critique splitté** : `admin-fields.css` chargé uniquement par `/admin/layout.tsx` (gain ~25 KB sur le bundle public).
6. **Local fonts via `next/font`** : zéro requête réseau pour Cormorant / Inter / Pinyon, `display: swap`.

---

## 7. Faiblesses & risques d'architecture

| Sujet | Constat | Sévérité |
|---|---|---|
| **`lib/` monolithique** | 124 k LOC dans un seul package. Si une 2ᵉ app arrive (mobile, admin séparé), il faudra extraire. | 🟡 P2 |
| **`packages/` inutilisé** | Le dossier existe vide. Aucun module partagé. OK aujourd'hui, à activer demain. | 🟢 |
| **`infra/` non commit** | Apparu en status (`?? infra/`). Risque : Terraform / docker-compose / clés en clair locales non versionnées. | 🟠 P1 |
| **`.env.bak.*` détectés** | 5 fichiers `.env.bak.20260513-*` dans `apps/web/`. Vérifier qu'ils sont gitignorés et qu'ils ne fuitent rien. | 🟠 P1 |
| **`dangerouslyAllowSVG: true`** | Activé sur next/image. Mitigé par CSP sandbox, mais reste un vecteur si une source distante est compromise. | 🟡 P2 |
| **Cron via Vercel cron config sur VPS** | `vercel.json` déclare 15 crons mais l'app n'est pas sur Vercel. Confusion possible → documenter clairement où les crons tournent réellement (probablement systemd timers). | 🟡 P2 |
| **Pas de React Query / SWR** | L'admin fait des fetchs manuels (`useEffect + fetch + setState`). Avec 124 pages admin, c'est coûteux en maintenance. Cité comme dette dans `docs/AUDIT-2026-05.md`. | 🟡 P2 |
| **`components/admin/` géant** | 317 fichiers, 50 % du dossier. Lourd pour le bundle si pas correctement split (vérifier qu'il n'est pas importé côté public). | 🟡 P2 |

---

## 8. Améliorations recommandées

### Priorité haute
1. **Documenter et committer `infra/`** (ou retirer si non utilisé). Ajouter un `infra/README.md` qui décrit clairement où tournent les crons (Vercel ? systemd ? Cloudflare Workers ?).
2. **Auditer les `.env.bak.*`** : exécuter `git ls-files | grep env`, confirmer qu'aucun n'est tracké, ajouter `.env*` (sauf `.env.example`) à `.gitignore`.
3. **Ouvrir un mini-ADR** (Architecture Decision Record) pour les choix structurants : pourquoi pas React Query, pourquoi iron-session vs NextAuth, pourquoi LangChain plutôt qu'AI SDK direct.

### Priorité moyenne
4. **Préparer l'extraction `packages/`** : repérer `lib/tracking`, `lib/chat`, `lib/webhooks` comme candidats à `@femiglow/tracking`, `@femiglow/chat`, `@femiglow/webhooks` si une app mobile arrive.
5. **Centraliser les middlewares HTTP** : créer `src/lib/http/` avec `requireAdminApi`, `requireSameOrigin`, `requireCronSecret`, `withRateLimit`, `withIdempotency` au même endroit.
6. **Migration Next.js 15** : prévoir 1–2 sprints. Bénéfices : `strict-dynamic` CSP (supprime `'unsafe-inline'`), turbopack stable, Server Actions matures, Partial Prerendering.

### Priorité basse
7. **Découper `components/admin/`** en sous-domaines (`tracking-admin/`, `products-admin/`, `emails-admin/`) avec barrels propres.
8. **Adopter React Query** progressivement sur l'admin (réduit le boilerplate fetch + cache + revalidation).

---

## 9. Scorecard

| Critère | Score | Commentaire |
|---|---|---|
| Choix techno | 9 / 10 | Next 14 + Drizzle + Zod + iron-session = best-in-class |
| Modularité | 8 / 10 | Bonne séparation `app`/`components`/`lib`, mais `lib/` à éclater à terme |
| Configuration | 9 / 10 | TS strict, gitleaks, Husky, Lighthouse, Drizzle strict — discipline |
| Convention de nommage | 9 / 10 | Cohérente partout |
| Couplage | 7 / 10 | Quelques couplages forts (CheckoutFlow ↔ lib/checkout) |
| Évolutivité | 8 / 10 | Prêt pour l'extraction packages quand une 2ᵉ app arrivera |
| **Global** | **8,3 / 10** | |
