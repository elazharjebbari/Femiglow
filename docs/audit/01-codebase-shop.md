# Codebase et structure du shop

Ce document cartographie l'application `apps/web` telle qu'elle existe au moment de l'audit : arborescence des routes Next.js, inventaire des composants, librairies métier, configuration et surface de tests.

## 1. Monorepo et conventions globales

- Outillage : **pnpm 9+**, **Node 20+**, workspace `pnpm-workspace.yaml`, scripts racine (`dev`, `build`, `lint`, `typecheck`, `test`, `format`, `secrets:scan` via gitleaks).
- Hooks Husky + lint-staged : ESLint et Prettier exécutés sur les fichiers de `apps/web/src/**/*.{ts,tsx,css,md}`.
- Une seule application : `apps/web` (Next.js 14, App Router). Phase 2 prévoit potentiellement d'autres packages (`packages/shared/`, mobile, etc.).

## 2. Routes Next.js (`apps/web/src/app/`)

### 2.1 Groupes de routes

| Groupe | Pages | Rôle |
| --- | --- | --- |
| `(marketing)` | `page.tsx` (accueil), `kit/`, `rituel/`, `maison/`, `journal/`, `journal/[slug]/`, `contact/` | Vitrine éditoriale B2C |
| `(commerce)` | `panier/`, `merci/` | Avant et après la transaction |
| `commander/` | Tunnel checkout (route hors groupe pour neutraliser le header marketing) | 3 étapes (livraison / paiement / validation) |
| `admin/` | 51 pages : dashboard, analytics, chat, components, products, media, leads, seo, settings, tracking, webhooks | Back-office |
| `api/` | 100+ routes (voir 2.3) | API REST internes |
| Standalone | `feed.xml`, `sitemap.ts`, `robots.ts`, `media-files/[...path]`, `not-found.tsx`, `error.tsx`, `layout.tsx`, `dev/` | Infra et utilitaires |

### 2.2 Pages B2C — résumé synthétique

| Route | Objectif funnel | Sections clés |
| --- | --- | --- |
| `/` | TOFU — accueil éditorial | Hero, 4 gestes, manifeste, avis, journal extraits, newsletter |
| `/rituel` | MOFU — narration | Hero, origine, vidéo 4 gestes, sciences, témoignage, pivot kit |
| `/kit` | BOFU — fiche produit pivot | Hero, slow reveal composition, vidéo, ingrédients, comparatif, FAQ, témoignages |
| `/journal` | MOFU + loyalty — hub éditorial | Article featured, filtres catégories, grille, newsletter |
| `/journal/[slug]` | SEO long-tail + engagement | Hero article, prose markdown, articles liés |
| `/maison` | MOFU / trust — récit fondateur | Hero, histoire, photo fondatrice (jamais de face), manifeste développé, engagements |
| `/panier` | Pre-checkout | Items, récap, up-sell discret, code partenaire replié |
| `/commander` | Checkout 3 étapes | Livraison → Paiement → Validation, récap sticky |
| `/merci` | Post-achat | Remerciement personnalisé, récap, timeline, lettre éditoriale signée Salma |
| `/contact` | Pont conversationnel | Coordonnées, formulaire à 3 types (question / order / professional), FAQ |

Détail complet : [05-pages-b2c.md](05-pages-b2c.md).

### 2.3 API routes

| Famille | Exemples | Rôle |
| --- | --- | --- |
| Chat | `/api/chat/{message,session,event,feedback}`, `/api/chat/lead/contact` | Orchestrateur LLM, sessions, lead capture |
| Produits | `/api/admin/products/[slug]`, `/api/admin/products/variants`, `/api/admin/products/feed`, `/api/admin/products/publish` | CRUD + export feeds (Google Merchant XML, JSON-LD) |
| Analytics | `/api/admin/analytics/*`, `/api/admin/insights/{live,overview,refresh}` | Agrégations + refresh des matérialised views |
| Tracking | `/api/track`, `/api/admin/tracking/{gtm,providers,events,configs}` | Pixel, GTM push, événements custom |
| Admin | `/api/admin/{login,logout,media,components}` | Auth Iron-session, opérations média |
| Cron | `/api/cron/{analytics-refresh,media-optimize,chat/purge}` | Jobs planifiés |
| Webhooks | `/api/admin/webhooks`, `/api/webhooks/stripe` | Endpoints sortants + entrants Stripe |
| Public | `/api/checkout`, `/api/contact`, `/api/newsletter`, `/api/health` | Surface client publique |

### 2.4 Admin back-office (`/admin`)

51 routes couvrant :

- **Dashboard** : KPI synthétique, leads récents, état webhooks.
- **Analytics** : onglets `overview`, `live`, `checkout`, `cta`, `funnel`, `insights`.
- **Chat** : conversations, instructions, providers, leads, KPIs, audit.
- **Components** : registre CMS (key, fields, animations, preview, schedule draft/published).
- **Products** : CRUD produits, feed, variants, SEO par produit.
- **Media** : upload, gallery, duplicates, regenerate, tags.
- **Leads** : vue leads avec statut + événements append-only.
- **SEO** : pages SEO, settings, overrides par scope.
- **Settings** : navigation, branding, flags, RBAC.
- **Tracking** : events, GTM configs, providers, inventory, logs.
- **Webhooks** : création/gestion endpoints, visualisation livraisons.

Point d'attention : la BDD couvre plus que l'UI. L'**analytics-insights** et le **chat** sont les plus aboutis ; **components** et **products** sont les modules clé à finir pour atteindre l'autonomie éditoriale promise.

## 3. Composants (`apps/web/src/components/`)

| Dossier | Volume | Rôle | Exemples |
| --- | --- | --- | --- |
| `ui/` | 16 | Primitifs typographiques et conteneurs | `Button`, `Container`, `Heading`, `Text`, `Fleuron`, `ScrollTracker` |
| `layout/` | 11 | Header, Footer, Shell, Navigation | `Header`, `Footer`, `SkipLink`, `MainLayout` |
| `sections/` | 109 | Blocs éditoriaux | `HeroBound`, `GestesGrid`, `AvisStrip`, `ArticleGrid`, `AtelierGallery`, `ManifesteBound`, `CrossLinks`, `NewsletterBlock` |
| `commerce/` | 50 | Panier et checkout | `CartButton`, `CartContents`, `CheckoutFlow`, `PriceDisplay`, `PaymentMethodSelector`, `OrderSummary`, `AddToCartButton` |
| `forms/` | 11 | Inputs typés + validation | `ContactForm`, `Field`, `NewsletterInput`, `LeadForm` |
| `patterns/` | 7 | Interaction | `Accordion`, `Reveal`, `Tabs`, `Stepper` |
| `admin/` | 21 | UI back-office | `AdminShell`, `LeadStatusMenu`, `ProductForm`, `MediaUpload`, `AnalyticsChart` |
| `chat/` | 21 | Chat visitor + admin | `ChatWidget`, `ChatPanel`, `ProviderSelector`, `MessageDisplay` |
| `tracking/` | 10 | Instrumentation | `ScrollMilestonesTracker`, `FormTracker`, `EventEmitter` |
| `icons/` | 1 | Sprite SVG | `icons.tsx` |

### Convention `Bound`

Les composants en `*Bound` (`HeroBound`, `AvisStripBound`, `ArticleCardBound`, etc.) sont la version « orchestrée » : ils résolvent les bindings média + données depuis la BDD via `lib/components/`, puis injectent dans la version pure (`Hero`, `AvisStrip`, `ArticleCard`). Ce séparé conserve le découplage data / présentation, indispensable pour Storybook et tests unitaires.

## 4. Librairies métier (`apps/web/src/lib/`)

| Module | Rôle |
| --- | --- |
| `admin-config/` | Config centralisée (navigation, flags, branding, RBAC) via table `app_config` + snapshots |
| `analytics/` | Agrégations insights, filtres, attribution, formatage. 28 fichiers dans `/insights/` |
| `audit/` | Trace `audit_events` (actor, resource, action, meta) |
| `auth/` | Session admin Iron-session, hash Argon2, `require-admin.ts`, RBAC |
| `boot/` | `seed-on-boot.ts` — bootstrap et migrations |
| `chat/` | Cœur LLM : `services/` (23 fichiers — orchestrator, intent, phone-detect, charter-filter, lead-decision) + `repos/` + `db/` (schéma + queries) |
| `cms/` | Adaptateur de source de données (mock Phase 1, Sanity Phase 2). Méthodes `getHomepageContent`, `getArticles`, etc. |
| `components/` | Résolution composants CMS + media-binding + animation-binding |
| `crypto/` | `encryption.ts`, `hmac.ts` — chiffrement clés API providers, signing webhooks |
| `db/` | Drizzle : `schema.ts` (1 409 lignes), `client.ts`, `queries/` (32 fichiers), `exec.ts`, `types.ts` (~23 ko de types générés) |
| `errors/` | Erreurs typées (`ApiError`, `ValidationError`) |
| `http/` | Wrapper fetch avec retry et headers normalisés |
| `i18n/` | Catégories `i18n/categories.ts` ; minimal Phase 1, FR par défaut |
| `icons/` | Sprite system SVG |
| `logging/` | Pino structuré JSON |
| `markdown/` | Pipeline `remark` + `rehype` (GFM, sanitize, headings) pour journal |
| `media/` | `/server/` (10), `/storage/` (5), types — pipeline upload, variants, jobs (`media_jobs`) |
| `products/` | `cache.ts`, `currency.ts`, `pricing.ts` + `/feed/` (14 fichiers : schema, Google Merchant XML, JSON-LD, linter, fuzz tests) |
| `rate-limit/` | Token bucket, clés par IP/session |
| `routes.ts` | Source unique des chemins typés (équivalent `defineRoute`) |
| `schemas/` | Zod source de vérité (Product, Article, ContactForm, Order…) |
| `seo/` | `json-ld.ts`, `og-image.ts`, resolvers d'overrides par scope (page/component/product/article) |
| `stores/` | Zustand : `cart-store.ts` |
| `tracking/` | `/server/` (14), `/gtm/` (24), `event-catalog.ts` (~30 ko), `provider system` — catalogue d'événements GA4-compatible, GTM configs chiffrés en BDD |
| `utils/` | Helpers (`cn` classnames, format-price, slug, etc.) |
| `webhooks/` | Signing, retry, delivery log |

## 5. Configuration et tooling

### 5.1 `package.json` (apps/web)

- **Next.js** 14.2.15 / **React** 18.3.1.
- **Drizzle ORM** 0.45.2 + driver `postgres`.
- **LangChain** 0.3.10 + intégrations OpenAI, Anthropic, Google GenAI, Mistral, Ollama.
- **Framer Motion** 11.11.0, **Zustand** 5.0.0, **React Hook Form** 7.53.0 + `@hookform/resolvers`.
- **Zod** 3.23.8, **Iron-session** 8.0.4, **Argon2** (password hashing).
- **Sharp** 0.34.5, **FFmpeg static** (pipeline média serveur).
- **Unified / Remark / Rehype** (markdown → HTML sanitize).
- **Drizzle-kit** 0.31.10 pour migrations.

Scripts utiles : `dev`, `build`, `test`, `test:watch`, `test:coverage`, `test:e2e`, `db:push`, `db:migrate`, `db:studio`, `seed:*` (admin, components, products, tracking, media, seo), `storybook`, `build-storybook`.

### 5.2 `next.config.mjs`

- Optimisation images : AVIF, WebP, JPEG, PNG. Device sizes `[360, 480, 720, 960, 1280, 1600, 1920]`. Cache TTL 30 jours.
- SVG passthrough autorisé pour les placeholders éditoriaux (Phase 1).
- `remotePatterns` : Sanity CDN, `images.femiglow.ma`, Vercel Blob — l'infra média Phase 2 est anticipée.
- Rewrites : `/_media/* → /media-files/*` (système média privé).
- Redirects : `/products/* → /kit`, `/blog/* → /journal/*` — la sémantique « rituel / journal » est appliquée jusque dans les URL.
- CSP nonce per-request + HSTS + X-Frame-Options via `middleware.ts`.
- `experimental` : `optimizePackageImports`, `serverComponentsExternalPackages: ['argon2', 'sharp', 'ffmpeg-static']`.

### 5.3 `tailwind.config.ts`

Tokens custom exposés en variables CSS :

| Catégorie | Valeurs |
| --- | --- |
| Couleurs | `creme` (warm), `encre` (soft), `sauge` (soft, dark), `petale` (soft, dark), `ciel` (soft, dark), `champagne` (soft, dark) |
| Typo | `display-{2xl,xl,lg,md,sm}`, `lead`, `kicker` ; familles `cormorant`, `inter`, `pinyon` |
| Spacing | `4, 8, 12, 16, 24, 32, 48, 64, 96, 128` + extensions `18, 22` |
| Shadows | `sm`, `md`, `lg`, `xl` (toutes très douces, base `rgba(44, 42, 40, 0.06)`) |
| Transitions | `instant` (100 ms), `fast` (200), `base` (300), `slow` (500), `cinematic` (800) |
| Easings | `out-soft`, `in-out-silk`, `in-quiet` |

## 6. Surface de tests

| Type | Outil | Volume approximatif | Couverture observée |
| --- | --- | --- | --- |
| Unit / component | **Vitest 2.1** | ~298 fichiers `*.test.ts(x)` | Products (reviews, feed, JSON-LD, fuzz), Chat (charter-filter, intent, lead-decision, phone-detect, orchestrator), Analytics, Tracking, Commerce (`AddToCartButton`, `CartSummary`, `PriceDisplay`, `ProgressBar`), Admin (`LoginForm`, `LeadStatusMenu`, `ProductForm`), Sections (`ArticleCard`, `ContactHero`, `AtelierGallery`, `EmptyCartState`), Lib (`ids`, `phone`, `crypto`) |
| E2E | **Playwright 1.48** | ~30 fichiers `e2e/*.spec.ts` | Admin analytics insights, GTM onboarding, Chat (admin + visitor + live OpenAI), Lead capture, Checkout, CSP headers, Auth login |
| Storybook | Storybook 8 | Composants UI | Showcase + visual review |

Pas de tests de charge dans le repo principal, mais un dossier `apps/web/k6/` indique qu'un benchmark k6 est prévu (utile à activer avant Phase 2).

## 7. Internationalisation

- `lib/i18n/categories.ts` : énumération courte des catégories produits.
- Phase 1 : FR uniquement, mock data en FR, contenus chat en FR.
- Phase 2 attendue : AR + AR-MA via Sanity. Le schéma chat (`bodyAr`, `bodyArMa` dans `chat_instruction_version`) anticipe le multilingue. Les pages, en revanche, n'ont pas encore de wrapper `next-intl` ou équivalent — toutes les chaînes éditoriales sont actuellement en FR direct dans les mocks ou composants. Risque de refactor Phase 2 si une nouvelle page est créée sans wrapper `t('clé')`.

## 8. Synthèse — points de repère pour les itérations à venir

- Toute nouvelle page se pose dans `apps/web/src/app/(marketing)/` ou `(commerce)/`, hérite du `layout.tsx` du groupe, et compose des `sections/` existantes avant de créer un nouveau bloc.
- Toute nouvelle variante de produit se modélise dans `lib/schemas/product.ts` (Zod) puis se peuple via le mock `data/mock/product.ts` ou directement via les tables `products` / `product_variants`.
- Tout nouveau composant se construit en deux temps : version pure (`MonComposant`) + version `MonComposantBound` qui résout les bindings.
- Tout texte utilisateur passe par les schémas Zod et les fichiers mock ; les chaînes ne sont jamais hardcodées dans les composants si elles sont éditoriales.
- Tout événement de tracking est déclaré dans `lib/tracking/event-catalog.ts` puis poussé via le provider system, jamais directement vers GA4.
