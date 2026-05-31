# Rapport exécutif — Audit FemiGlow

## En une phrase

FemiGlow est une boutique e-commerce marocaine en Next.js (App Router, monorepo pnpm), Phase 1 (prototype B2C) très avancée, dont la base technique — schéma BDD de 40+ tables, système média complet, tracking GA4-compatible, chat assistant LangChain, plus de 300 tests automatisés — dépasse de loin la maturité visuelle d'un simple prototype, et qui s'appuie sur une spécification éditoriale et graphique d'une rigueur inhabituelle.

## Quatre constats forts

### 1. Une marque sur-spécifiée, dans le bon sens

La voix « maison / rituel / initiée », la palette **sauge / crème / encre** (`#C5DBC4` / `#FBF8F1` / `#2C2A28`) avec ses accents **pétale / ciel / champagne**, le trio typographique **Pinyon Script (wordmark uniquement) / Cormorant Garamond (titres) / Inter (UI)**, et le lexique do/don't sont définis avec une exhaustivité de cabinet de conseil. Chaque page B2C dispose d'une fiche `docs/pages/b2c/FemiGlow_Page_*.md` qui prescrit jusqu'au pourcentage de la palette, à la durée d'animation (300–400 ms slow motion), à la formulation des CTA (« Recevoir le rituel » jamais « Acheter »), aux interdictions formelles (pas d'emoji, pas de visage de face, pas d'urgence).

### 2. Une architecture technique calibrée pour la Phase 2

Le découplage CMS est fait dès Phase 1 via un adaptateur (`lib/cms/`) et des schémas Zod uniques source de vérité pour types TS + validation runtime + interface CMS. Les composants `*Bound` orchestrent données + médias depuis la BDD, mais leurs primitifs UI sont CMS-agnostiques. Le passage mocks → Sanity Phase 2 sera un swap d'adaptateur, sans réécriture des pages. Cette discipline architecturale est l'élément le plus précieux du projet et doit être préservée.

### 3. Une base de données démesurée par rapport au front actuel

40+ tables Drizzle (`apps/web/src/lib/db/schema.ts`, 1 409 lignes) couvrent : admin/CRM (`leads`, `lead_events`, `orders`, `webhook_endpoints`, `audit_events`), média (`media`, `media_variants`, `media_jobs`), tracking GA4-like (`tracking_events_log`, `tracking_event_definitions`, `tracking_providers`, consent), insights pré-agrégés (`insights_event_daily`, `insights_funnel_daily`), components-CMS (`component_field_bindings`, `component_field_history`, `component_media_bindings`), produits (`products`, `product_variants`, `product_snapshots`), SEO (`seo_overrides`, `seo_settings`), A/B testing (`experiments`, `experiment_variants`), chat (10+ tables dans `lib/chat/db/schema.ts`, 543 lignes). 15 migrations sont versionnées (`drizzle/migrations/0000_initial.sql` à `0015_insights_init.sql`).

Conséquence : on peut piloter quasiment tout depuis l'admin sans toucher au code, mais cela suppose que l'**admin UI** (encore partielle) suive le rythme du schéma. Le décalage est aujourd'hui le principal risque opérationnel.

### 4. La voix de marque interdit les leviers e-commerce classiques

Pas de countdown, pas de bandeau « offre flash », pas de pop-up, pas d'étoiles d'avis, pas de wishlist, pas de visage de face, pas de point d'exclamation, pas d'emoji. Le luxe se signale ici par ce qu'il refuse — refus documenté (Sevilla & Townsend 2016 : +23 % premium perçu via empty space). Toute itération future (variante de produit, reformulation, nouvelle page) devra arbitrer entre les heuristiques Kolenda (cf. document 03) et cette discipline éditoriale plus stricte que la moyenne du secteur.

## Périmètre observé

| Domaine | État | Source |
| --- | --- | --- |
| Pages B2C (9) | Toutes scaffoldées, données mock, contenu éditorial conforme | `apps/web/src/app/(marketing)/`, `(commerce)/` |
| Tunnel checkout | 3 étapes (livraison / paiement / validation), stub Stripe | `apps/web/src/app/commander/` |
| Admin back-office | 51 pages, dashboard + 10 sections (analytics, chat, components, products, media, leads, seo, settings, tracking, webhooks) | `apps/web/src/app/admin/` |
| API | 100+ routes (chat, products, analytics, tracking, admin, cron, webhooks, public) | `apps/web/src/app/api/` |
| Composants | ~250 (16 ui, 11 layout, 109 sections, 50 commerce, 21 admin, 21 chat, 11 forms, 10 tracking, 7 patterns, 1 icons) | `apps/web/src/components/` |
| Schéma BDD | 40+ tables, 15 migrations, enums denses, indexes composites et partiels | `apps/web/src/lib/db/schema.ts` + `lib/chat/db/schema.ts` |
| Tests | ~298 Vitest + 30 Playwright e2e | `apps/web/src/**/*.test.ts(x)`, `apps/web/e2e/` |
| Médias | 100+ assets `public/{avis,captions,fonts,journal,maison,og,products,rituel,testimonials,videos}` + système BDD avec variants, phash, blurhash | `apps/web/public/`, table `media` |
| Spécifications | 9 fiches pages + charte + architecture + 15 docs préparation + 9 plans d'exécution + 8 PDF Kolenda + 17 docs modules | `docs/` |

## Décisions techniques structurantes

1. **Next.js 14 App Router + React 18** avec route groups `(marketing)` et `(commerce)`.
2. **Drizzle ORM 0.45** + Postgres + pgvector (embeddings chat).
3. **Zod 3.23** comme source unique des modèles métier.
4. **LangChain 0.3** multi-providers (OpenAI / Anthropic / Google / Mistral / Ollama) pour le chat assistant.
5. **Framer Motion 11** + **Zustand 5** pour animations et état client.
6. **Tailwind 3.4** avec tokens custom (palette FemiGlow, transitions cinematic 800 ms, easings out-soft / silk / quiet).
7. **Sharp + FFmpeg static** pour pipeline média serveur, **Iron-session + Argon2** pour auth admin.
8. **Stripe + Vercel Blob + Neon Postgres** suggérés par les `remotePatterns` de `next.config.mjs`.

## Lignes éditoriales non-négociables (à respecter dans toute itération)

- Lexique : **rituel**, **geste**, **maison**, **initiée**, **éclat**, **patience**, **complice**. Interdits : produit, cliente, acheter, vernis, promotion, urgence.
- Couleurs : règle 60-30-10 (dominante sauge B2C, support crème, accent encre). Champagne ≤ 5 %, jamais en aplat.
- Typographies : Pinyon **uniquement** wordmark. Cormorant sans bold. Inter min 13 pt.
- Imagerie : mains et gestes, jamais visages de face. Vidéos en slow motion, sans musique.
- Aucun emoji, aucun point d'exclamation, aucune urgence factice, aucune réduction visible.
- Apostrophes courbes (U+2019), espaces fines insécables (U+202F) dans les guillemets français, em-dashes (U+2014) littéraux.

## Risques et points d'attention

1. **Décalage admin UI / schéma BDD** — la BDD est prête, l'admin partiellement câblée ; toute itération produit doit vérifier que l'UI admin permet de la piloter sans script.
2. **Multilingue Phase 2 (FR / AR / AR-MA)** — le schéma chat est déjà préparé (`bodyAr`, `bodyArMa`), mais la couche `lib/i18n/` reste minimale. Risque de refactor coûteux si des chaînes sont hardcodées sans wrapper i18n.
3. **Paiement Maroc** — CMI + Stripe + COD doivent coexister ; le scaffold actuel privilégie Stripe Elements, COD à 35–40 % des commandes marocaines doit être visible dès l'étape 2 du tunnel.
4. **Comptes guest-only Phase 1** — pas d'entité `User` dans les schémas Zod, schéma `customer` minimal sur `orders`. Phase 2 demandera une modélisation complète.
5. **Catalogue mono-produit** — Phase 1 assume un seul kit (`product.ts`). Le schéma `products` + `product_variants` supporte le multi-produit, mais les mocks et la page `/kit` doivent être préparés à une extension.

## Ce que ce dossier permet

- Toute reformulation de copy peut s'appuyer sur le glossaire éditorial et les heuristiques Kolenda sans réinventer la voix.
- Toute variante de produit peut s'inscrire dans le schéma `products` / `product_variants` existant, et hériter du pipeline média + SEO + tracking sans nouveau code structurel.
- Toute nouvelle page peut suivre le gabarit des fiches `docs/pages/b2c/` (objectif, KPI, sections, voix, données) et le plan d'exécution canonique des 9 plans `docs/plans/`.
- Toute évolution UI peut s'aligner sur les tokens CSS (`src/styles/tokens.css`) et les composants `ui/` + `sections/` déjà testés.

Le reste du dossier déploie chacun de ces axes en détail.
