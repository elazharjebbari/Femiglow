# Modules spécialisés

Ce document recense les modules transverses de l'application : leur rôle, leur niveau de maturité, et les invariants à respecter dans les itérations futures. Chaque module possède un dossier de documentation associé dans `docs/`.

## 1. Admin et configuration

### `admin/`

Back-office FemiGlow protégé par session Iron-session. 51 routes Next.js (dashboard + 10 sections). Chaque section consomme l'API admin (`/api/admin/*`) et ne lit jamais directement la BDD côté client.

Invariants :

- Auth obligatoire via `require-admin()` dans tout `route.ts` ou `page.tsx` d'admin.
- Toute action mutante passe par une route API qui logge dans `audit_events`.
- Les composants admin sont isolés dans `components/admin/` et n'utilisent pas les sections marketing.

### `admin-config/`

Configuration runtime centralisée (navigation, branding, flags, RBAC), table `app_config`. Édition sans redéploiement. Snapshots immuables (`app_config_snapshots`) pour rollback.

Use case Phase 2 : activer la 5e entrée menu « Partenaires » sans toucher au code.

## 2. Analytics et insights

### `analytics/`

Tableau de bord admin en 5 onglets :

- **Overview** — KPIs synthétiques, séries temporelles.
- **Live** — événements en temps réel.
- **Funnel** — view_item → add_to_cart → begin_checkout → purchase.
- **CTA** — performance par bouton.
- **Checkout** — taux d'abandon par étape.

Source : `tracking_events_log` + matérialised views `insights_*`.

### `analytics-insights/`

Module v1.4 (cf. commit `ec8b623`). Couche d'agrégation au-dessus de `tracking_events_log` :

- 6 tables `insights_*` (event_daily, page_daily, component_daily, section_daily, funnel_daily, refresh_run).
- Cron `/api/cron/analytics-refresh` rafraîchit les vues.
- UI admin avec filtres avancés (env, device, locale, traffic source, experiment variant).
- Tests Playwright dédiés (`apps/web/e2e/admin-analytics-insights.spec.ts`).

Invariant : ne jamais lire `tracking_events_log` directement dans une page utilisateur — toujours passer par les insights.

## 3. Tracking et GTM

### `tracking/`

Système complet d'instrumentation événementielle :

- **Catalogue typé** dans `lib/tracking/event-catalog.ts` (~30 ko). Chaque événement a un nom canonique, un scope (web/server/both), une catégorie, des paramètres typés.
- **Inventaire pages + composants** dans tables `tracking_pages`, `tracking_components`.
- **Providers chiffrés** : Meta, TikTok, GA4, GTM, custom. Token chiffré via `lib/crypto/`.
- **Consent management** par session (`tracking_consent_snapshots`), avec flags globaux (`tracking_settings` peut désactiver la bannière au Maroc).
- **Console admin** dédiée pour piloter pages/components/events.

### `gtm/`

Configuration Google Tag Manager complète : audit événements, conteneurs, variables, triggers, tags, mapping conversions, automatisation par API. Tests Playwright onboarding (`admin-tracking-gtm-onboarding.spec.ts`).

Invariant : tout événement utilisateur émis depuis le front passe par le provider system, jamais directement vers `gtag()` ou `fbq()`.

### `carrousels-meta/`

Spec dédiée à la production de carrousels Meta Ads à partir des assets et messages de la maison. Document de cadrage, pas d'implémentation directe dans `apps/web` Phase 1.

## 4. Components CMS et media system

### `components-cms/`

Pilotage éditorial des composants. Tables :

- `site_components` — registre par key (hero, section, card, gallery, carousel, banner).
- `component_field_bindings` — valeurs par locale (fr/ar/arMa), statut (draft/published/scheduled/archived), version.
- `component_field_history` — audit immuable (8 actions).

Workflow : édition draft → preview → schedule → publish, avec restauration possible.

### `component-media-system/`

Liaison composant ↔ média par slot :

- `component_media_bindings` — un binding = (composant × slot × média), avec `loading_strategy`, `fetch_priority`, `focal_point`, `object_fit`, `placeholder_strategy`.
- `component_animations` + `component_animation_bindings` — presets framer-motion / css / svg, respect `prefers-reduced-motion`.

### `media/` et `images/`

Pipeline média serveur :

- `media` (asset original) + `media_variants` (responsives, AVIF/WebP/JPEG, breakpoints).
- `media_jobs` queue async (optimize, regenerate, phash, delete).
- Sharp pour images, FFmpeg static pour vidéos.
- phash pour déduplication, blurhash pour placeholder.
- Variants stockées localement Phase 1, Vercel Blob anticipé Phase 2 (cf. `remotePatterns` `next.config.mjs`).

Invariants :

- Aucune image hors-pipeline (interdit `<img src="...">` direct ; toujours `next/image` + composants `*Bound`).
- Aucun visage de face. Toute nouvelle image passe la revue éditoriale.

## 5. Products CMS et feeds

### `products-cms/`

Catalogue piloté depuis l'admin :

- `products` — fiche produit (slug, status draft/published/archived, title, tagline, description, tags, position, featured, published_at).
- `product_variants` — déclinaisons (sku, label, price_cents, promo_price, currency MAD/EUR, inventory_status, attributes JSONB).
- `product_snapshots` — versioning.

Phase 1 : un seul produit (Kit Rituel d'Éclat). Schéma prêt pour multi-produit Phase 2.

### `feed-produit/`

Export Google Merchant Center XML, JSON-LD, kit-feed composite, linter de validation, fuzz tests. Module mature (cf. `docs/feed-produit/20-rapport-amelioration-CHA-225.md`).

Invariant : toute nouvelle variante produit doit passer le linter avant publication du flux.

## 6. SEO

### `seo-cms/`

Gestion centralisée :

- `seo_settings` — defaults globaux (site name, OG image, twitter, jsonld).
- `seo_overrides` — par scope (page/component/product/article) × target_key × locale.
- `seo_audit_snapshots` — historique audits.

Génération OG dynamique côté serveur, JSON-LD product/article/breadcrumb injecté par `lib/seo/`.

Invariants :

- Title 50–60 caractères, description 50–160 caractères (validé Zod).
- Toute nouvelle page = entrée `seo_settings` + sitemap auto-régénéré.

## 7. Chat assistant

### `chat-assistant/`

Module conversationnel IA basé sur LangChain 0.3 multi-provider (OpenAI, Anthropic, Google GenAI, Mistral, Ollama).

Architecture serveur :

- `lib/chat/services/` — orchestrator (pipeline), intent extraction, phone detection, charter filter (modération conforme à la voix maison), lead-decision (décide quand proposer la capture).
- `lib/chat/repos/` — accès aux tables `chat_*`.
- `lib/chat/db/schema.ts` — 11 tables (sessions, messages, providers chiffrés, knowledge pgvector, lead requests, KPIs, feedback, rate limit).

Knowledge base :

- 13 fichiers markdown FR dans `apps/web/content/chat-knowledge/` (kit, pricing, ingrédients, rituel matin/soir, objections, shipping, retour, contact, confirmation, avis).
- Embeddings stockés en pgvector.

Front :

- Widget persistant (`components/chat/ChatWidget.tsx`) sur toutes les pages B2C.
- Salutations contextuelles par page et locale.
- Capture de lead via webhook si confidence > seuil (table `chat_lead_request` + `webhook_endpoints`).

Lead capture (cf. commit `61a03d2` CHA-225) :

- L'orchestrator détecte une opportunité (intent + phone + nom).
- Le lead est créé puis poussé via webhook chiffré.
- Échec → retry exponentiel.

Tests Vitest dédiés : `charter-filter`, `intent`, `lead-decision`, `phone-detect`, `orchestrator`, `orchestrator-lead-capture`. Tests Playwright admin + visitor + live OpenAI.

Multilingue : `chat_instruction_version.body` + `bodyAr` + `bodyArMa` — module de référence pour le multilingue Phase 2.

## 8. Checkout funnel

### `checkout-funnel/`

Documentation stratégique sur l'optimisation du tunnel (notes récentes dans `docs/checkout-funnel/`, untracked). Aucun changement code Phase 1, propose une refonte progressive des abandons panier.

Invariant : la couche `commerce/` (50 composants) + `commander/` page + `lib/stores/cart-store.ts` Zustand reste la seule source. Ne pas introduire de second store cart.

## 9. Menu et navigation

### `menu/`

Documentation de la navigation principale. Header B2C à 4 entrées, footer à 4 colonnes (cf. document 04). 5e entrée « Partenaires » réservée Phase 2.

## 10. Webhooks et intégrations sortantes

Tables `webhook_endpoints` (URL, events, secret chiffré, active) et `webhook_deliveries` (status, attempt_count, response logs). Signing HMAC via `lib/crypto/hmac.ts`. Retry exponentiel.

Cas d'usage Phase 1 : poussée des lead chat vers un CRM externe. Phase 2 prévue : intégrations Mailchimp / Brevo / CMI Maroc.

## 11. Plans d'exécution

### `plans/`

9 plans détaillés (un par page B2C), gabarit unique : objectif + KPIs, documents à relire, dépendances, écarts spec/scaffold, phases séquentielles, DoD spécifique, métriques avant/après, risques + mitigations, estimation horaire, annexes.

Ordre recommandé :

| # | Page | Charge nette |
| --- | --- | --- |
| 01 | `/` | 22 h |
| 02 | `/rituel` | 22–28 h |
| 03 | `/kit` | 24–30 h |
| 04 | `/journal` | 16–22 h |
| 05 | `/journal/[slug]` | 18–24 h |
| 06 | `/maison` | 18–24 h |
| 07 | `/contact` | 14–20 h |
| 08 | `/panier` | 12–18 h |
| 09 | `/commander` + `/merci` | 26–34 h |

Total estimé : 172–222 h. Checkout en dernier, car il dépend de tous les patterns établis (formulaires, validation, états async, accessibilité).

Directive cardinale : *« Une page n'est terminée que lorsqu'on n'a rien à excuser. »*

## 12. Préparation

### `preparation/`

Dossier fondateur de 15 documents + 3 annexes :

| # | Document |
| --- | --- |
| 00 | Résumé exécutif |
| 01 | Marque, vision, voix |
| 02 | Design system |
| 03 | Architecture de l'information |
| 04 | Spécifications des pages |
| 05 | Bibliothèque de composants |
| 06 | Architecture technique |
| 07 | Modèles de données et API |
| 08 | UX, animations, micro-interactions |
| 09 | Ergonomie et accessibilité |
| 10 | Performance et Web Vitals |
| 11 | SEO et métadonnées |
| 12 | QA, debugging, observabilité |
| 13 | Modularité, évolutivité, maintenabilité |
| 14 | Roadmap d'exécution |
| 15 | Stratégie d'itération composant par composant |

Annexes : `tokens.css.md`, `composants-index.md`, `glossaire-editorial.md`.

Ce dossier reste la source de référence en cas de doute. Avant toute itération significative, relire au minimum les documents 01, 02, 03, 07, 13.

## 13. Synthèse — niveaux de maturité par module

| Module | Maturité | Note |
| --- | --- | --- |
| Schéma BDD (40+ tables) | Production-ready | 15 migrations cohérentes |
| Pipeline média | Production-ready | Sharp + FFmpeg + variants + phash |
| Tracking / event-catalog | Mature | Catalogue typé, providers chiffrés |
| Analytics insights | Mature (v1.4) | Cron + matérialised views |
| Chat assistant | Mature (CHA-225) | RAG + lead capture + multilingue déjà prêt |
| Auth admin | Mature | Iron-session + Argon2 + RBAC |
| Products CMS BDD | Schéma mature, UI admin partielle | Multi-produit non testé |
| Components CMS BDD | Schéma mature, UI admin partielle | Édition fonctionnelle, scheduling à vérifier |
| SEO CMS | Mature | Overrides + sitemap + JSON-LD |
| Feed produit (Merchant) | Mature | XML + JSON-LD + linter + fuzz |
| Webhooks | Mature | Signing + retry exponentiel |
| Tunnel checkout | Scaffold + stub Stripe | À finaliser avec CMI + COD |
| Pages B2C scaffold | 9/9 en place | Données mock à brancher CMS Phase 2 |
| i18n FR/AR | Préparé sans implémentation Phase 1 | Risque refactor si chaînes hardcodées |
| A/B testing | Tables prêtes, framework non câblé | Phase 2 |
| Plans d'exécution | 9/9 rédigés | À tenir à jour entre les itérations |
