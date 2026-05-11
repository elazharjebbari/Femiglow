# Feeds, base de données et sources de contenu

Ce document inventorie les modèles de données du projet : schémas Drizzle, migrations, mocks Phase 1, content/, assets statiques, feeds produit. L'objectif est de pouvoir, à partir de ce dossier, raisonner sur où vit chaque donnée et comment l'enrichir sans casser le découplage CMS.

## 1. Vue d'ensemble — quatre couches de données

| Couche | Rôle | Localisation |
| --- | --- | --- |
| **Schémas Zod** | Source unique de vérité métier (type TS + validation runtime + interface CMS) | `apps/web/src/lib/schemas/`, `lib/db/types.ts` |
| **Base Drizzle** | Persistance Postgres pour CMS, admin, tracking, chat, médias, insights | `apps/web/src/lib/db/schema.ts` (1 409 lignes), `lib/chat/db/schema.ts` (543 lignes) |
| **Mock data** | Sources Phase 1 pour homepage, kit, rituel, maison, journal, contact | `apps/web/src/data/mock/` |
| **Content statique** | Knowledge base chat assistant (markdown FR) | `apps/web/content/chat-knowledge/` |

L'adaptateur `lib/cms/` est le seul point de passage entre composants et données. En Phase 1 il sert les mocks ; en Phase 2 il interrogera Sanity (ou autre) avec le même contrat.

## 2. Schéma Drizzle principal (`lib/db/schema.ts`)

### 2.1 Groupes de tables

#### Admin / CRM

| Table | Champs clés | Note |
| --- | --- | --- |
| `admin_users` | `id`, `email` (unique), `password_hash` (Argon2), `name`, timestamps | Auth admin Iron-session |
| `leads` | `email`, `phone`, `status` (enum), `source`, `marketing_consent` | Statuts : new / contacted / qualified / converted / lost / archived |
| `lead_events` | Log append-only par lead | Actions : created / status_changed / note_added / order_linked / webhook_dispatched |
| `orders` | `total_cents`, `currency`, `shipping_mode`, `payment_method`, lien lead | Conçu pour COD + carte + Stripe |
| `order_items` | `sku`, `qty`, `unit_price_cents` | Lignes commande |

#### Webhooks et audit

| Table | Champs clés |
| --- | --- |
| `webhook_endpoints` | URL, events array, `secret` chiffré, `active` |
| `webhook_deliveries` | `status` (pending / in_progress / succeeded / failed / permanent), `attempt_count`, response logs |
| `audit_events` | `actor`, `resource`, `action`, `meta` JSONB |

#### Média (système complet)

| Table | Rôle |
| --- | --- |
| `media` | Asset original : `kind` (image/video/audio), `slug` unique, dimensions, durée, `phash`, `blurhash`, palette, `alt`, `caption`, `credit` |
| `media_variants` | Variantes redimensionnées : `format` (avif/webp/jpeg/png/mp4/webm/mp3/opus), `breakpoint`, `checksum` |
| `media_tags` + `media_to_tags` | Organisation par tags (M2M) |
| `media_usages` | Tracking d'usage : `context` (hero / inline / thumb / og), page, composant |
| `media_jobs` | Queue async : `kind` (optimize / regenerate / phash / delete), `status` (pending / in_progress / done / failed) |

#### Tracking et analytics

| Table | Rôle |
| --- | --- |
| `tracking_pages` | Registre routes (title, category, metadata) |
| `tracking_components` | Registre composants (path, `category` parmi 28 valeurs : `cta_primary`, `media_image`, `section_hero`, etc.) |
| `tracking_pages_components` | M2M avec position |
| `tracking_event_definitions` | Catalogue typé : `scope` (web/server/both), `category` (page/engagement/ecommerce/lead/media/admin), `params` JSONB, `funnel_stage` (tof/mof/bof/conversion), `conversion` flag |
| `tracking_component_events` | Binding event × component avec overrides |
| `tracking_providers` | Configs Meta / TikTok / GA4 / GTM / custom — token chiffré, `config` JSONB |
| `tracking_events_log` | Raw events append-only : session, anonymous_id, device, locale, consent snapshot, providers dispatched, traffic source/medium, experiment variant |
| `tracking_consent_snapshots` | État consentement par session |
| `tracking_settings` | Flags globaux (ex. désactiver bannière consent au Maroc) |

#### Composants media-system

| Table | Rôle |
| --- | --- |
| `site_components` | Registre par `key` unique (name, category hero/section/card/gallery, page group, fields CMS, slots, animation support) |
| `component_media_bindings` | Liaison composant → média par slot (`loading_strategy`, `fetch_priority`, `focal_point`, `object_fit`, `placeholder_strategy`) |
| `component_animations` | Presets : `kind` (framer-motion / css / svg), config, `respects_reduced_motion` |
| `component_animation_bindings` | Binding animation × component avec params |

#### Components CMS (éditorial)

| Table | Rôle |
| --- | --- |
| `component_field_bindings` | Champs éditoriaux typés : `fieldKey`, `locale` (fr/ar/arMa), `value` JSONB, `status` (draft/published/scheduled/archived), `version`, `scheduled_at` |
| `component_field_history` | Audit immuable : `version`, action (create/update/publish/unpublish/restore/archive/schedule) |

#### Admin config

| Table | Rôle |
| --- | --- |
| `app_config` | KV section → payload (navigation, branding, flags, RBAC) |
| `app_config_snapshots` | Snapshots versionnés immuables |

#### SEO CMS

| Table | Rôle |
| --- | --- |
| `seo_overrides` | Overrides title/description/og/twitter par `scope` (page/component/product/article) et `target_key` + locale |
| `seo_settings` | Defaults globaux (site name, og image, twitter, jsonld) |
| `seo_audit_snapshots` | Audit trail SEO |

#### Products CMS

| Table | Rôle |
| --- | --- |
| `products` | `slug` unique, `status` (draft/published/archived), `title`, `tagline`, `description`, `tags`, `position`, `featured`, `published_at` |
| `product_variants` | `sku` unique par produit, `label`, `price_cents`, `promo_price`, `currency` (MAD/EUR), `inventory_status`, `attributes` JSONB |
| `product_snapshots` | Snapshots versionnés |

Inventory enum : `available` / `low_stock` / `out_of_stock` / `preorder`.

#### A/B testing (vide Phase 1)

| Table | Rôle |
| --- | --- |
| `experiments` | `name`, `hypothesis`, `status` (draft/running/paused/completed/archived), métriques, audience filter |
| `experiment_variants` | `key`, `label`, `is_control`, `weight`, `config` |
| `experiment_assignments` | Anonymous × variant |

#### Analytics insights (pré-agrégés)

| Table | Granularité |
| --- | --- |
| `insights_event_daily` | Event × jour × env × device × locale → count, unique sessions, conversions |
| `insights_page_daily` | Page × jour → pageviews, unique visitors, scroll75, bounce, avg time |
| `insights_component_daily` | Component × event × jour → count, unique sessions, conversions |
| `insights_section_daily` | Section × page × jour → views, avg dwell seconds |
| `insights_funnel_daily` | Funnel ecommerce jour : view_item / add_to_cart / begin_checkout / add_payment / purchase / generate_lead / revenue |
| `insights_refresh_run` | Audit cron : trigger, status, duration, counts, error logs |

### 2.2 Indexes notables

- Uniques : `media.slug`, `admin_users.email`, `products.slug`, `tracking_pages.route`, `seo_overrides (scope + target + locale)`.
- Composites : `tracking_events_log (event_id, event_name, received_at, session_id)`, `insights (date, event_name / component / page)`.
- Partiels : `media.phash IS NOT NULL`, `tracking_events.is_conversion = true`, `cfb.status = 'published'`.

## 3. Schéma Chat (`lib/chat/db/schema.ts`)

| Table | Rôle |
| --- | --- |
| `chat_instruction_version` | Versions immuables d'instructions système : `scope` (default), `body` + `bodyAr` + `bodyArMa`, `enabled` |
| `chat_theme_preset` | Tokens CSS, layout (position, dimensions), motion (`jitter`), salutations par page et locale |
| `chat_provider_config` | Provider chiffré : `kind` (openai/anthropic/google/mistral/ollama), clés API, `config` JSONB |
| `chat_session` | Session visiteur : initialized, runtime setting override, lead capture state, feedback score |
| `chat_message` | Messages append-only : `role` (user/assistant), content, token count, embeddings pgvector |
| `chat_knowledge_item` | Knowledge base markdown indexé pgvector |
| `chat_knowledge_metadata` | Versioning : source URL/date, embedding model, section refs |
| `chat_lead_request` | Lead capture : phone, email, name, intent, confidence, `status` (pending/sent/failed) |
| `chat_event_kpi` | KPI append-only : topic, subtopic, user/bot/system action |
| `chat_feedback` | Ratings post-message |
| `chat_rate_limit_bucket` | Token bucket per visitor |

Le multilingue (FR / AR / AR-MA) est déjà câblé dans `chat_instruction_version` — ce qui en fait un cas d'usage de référence pour étendre le reste du CMS Phase 2.

## 4. Migrations Drizzle (`drizzle/migrations/`)

| Migration | Sujet |
| --- | --- |
| `0000_initial.sql` | Admin users, leads, orders, webhooks, audit |
| `0001_media.sql` | Media + variants + tags + usages + jobs |
| `0002_tracking.sql` | Pages, components, event definitions, providers, events log, consent |
| `0003_tracking_settings.sql` | KV settings (ex. disable consent banner) |
| `0004_component_media_system.sql` | Bindings, animations, focal points |
| `0005_components_cms.sql` | Field bindings, history |
| `0006_admin_config.sql` | App config + snapshots |
| `0007_seo_cms.sql` | Overrides, settings, audit snapshots |
| `0008_products_cms.sql` | Products, variants, snapshots |
| `0009_analytics_columns.sql` | Colonnes attribution (traffic source, medium, experiment) |
| `0010_analytics_matviews.sql` | 4 matérialised views (overview_hourly, pages_daily, etc.) |
| `0011_analytics_ab_tests.sql` | Experiments, variants, assignments |
| `0012_chat_init.sql` | Sessions, messages, providers, knowledge, KPI |
| `0013_chat_runtime_setting.sql` | Runtime override par session |
| `0014_chat_lead.sql` | Lead requests + webhook system |
| `0015_insights_init.sql` | 6 insights tables + refresh_run |

15 migrations cohérentes, séquencées par domaine. Aucune migration de rollback n'est explicitement présente — usage du modèle « forward-only » Drizzle.

## 5. Mock data (`apps/web/src/data/mock/`)

| Fichier | Contenu | Forme attendue |
| --- | --- | --- |
| `product.ts` | Kit Rituel d'Éclat (id, slug, name, tagline, priceCents = 32 000, composition 4 pots, images, inStock) | `Product` Zod |
| `homepage.ts` | Hero, 4 gestes, manifeste 3 lignes, témoignages, journal extraits | `AccueilPageData` |
| `kit.ts` | Présentation kit : description détaillée, pricing, shipping, FAQ, témoignages | `KitPageData` |
| `rituel.ts` | Rituel matin/soir, instructions | `RituelPageData` |
| `maison.ts` | Brand story Casablanca, héritage, engagements, photo fondatrice (jamais portrait de face) | `MaisonPageData` |
| `articles.ts` | 20 articles journal : meta, excerpt, body prose markdown | `Article[]` |
| `index.ts` | Re-export | — |

Tous les mocks sont en FR strict. Phase 2 attendue : remplacement par requêtes Sanity, avec contenus FR / AR / AR-MA.

## 6. Content statique (`apps/web/content/chat-knowledge/`)

13 fichiers markdown, ~ 980 lignes au total :

| Fichier | Sujet | Taille |
| --- | --- | --- |
| `01-kit-overview.md` | Présentation kit | 1.9 ko |
| `02-pricing-shipping-maroc.md` | Tarifs et délais Casablanca | 1.7 ko |
| `03-ingredients.md` | Composition détaillée | 2.0 ko |
| `04-rituel-soir.md` | Rituel soir | 1.5 ko |
| `05-rituel-matin.md` | Rituel matin | 1.1 ko |
| `06-objection-pas-medical.md` | Réponse à objection « ce n'est pas médical » | — |
| `07-objection-trop-cher.md` | Réponse à objection prix | — |
| `08-objection-ca-marche.md` | Réponse à objection efficacité | — |
| `09-shipping-delais.md` | Détails livraison | 2.9 ko |
| `10-retour-garantie.md` | Retour et garantie | — |
| `11-contact-info.md` | Contact | — |
| `12-confirmation-commande.md` | Confirmation | — |
| `13-avis-clients.md` | Témoignages structurés | — |

Indexés en `chat_knowledge_item` avec embeddings pgvector → utilisés par l'orchestrator chat pour la RAG.

## 7. Assets publics (`apps/web/public/`)

```
public/
├── avis/             Témoignages clientes (photos mains, jamais visages)
├── captions/         Overlays SVG (sous-titres vidéo, étiquettes)
├── fonts/            Pinyon Script, Cormorant Garamond, Inter
├── journal/          ~20 images d'en-tête d'articles
├── maison/           ~16 photos atelier (mains, gestes, détails table)
├── og/               Templates OG dynamiques
├── products/         Photographie produit + composition kit
├── rituel/           5 visuels d'étapes
├── testimonials/     8 photos témoignages
└── videos/           3 fichiers MP4/WebM (slow motion 4 gestes)
```

Au total ~100+ assets gérés via `next/image` + table `media` BDD. Le pipeline `media_jobs` (Sharp + FFmpeg static) prépare AVIF/WebP responsifs.

## 8. Feeds produit

Le module `lib/products/feed/` (14 fichiers) couvre :

- **Google Merchant Center XML** : flux conforme au standard, généré à la demande via `/api/admin/products/feed`.
- **JSON-LD** schema.org : injection produit/breadcrumb sur la fiche kit.
- **Kit feed** : variante spécifique pour le kit composite (4 sous-produits).
- **Linter** : validation des champs obligatoires (id, title, description, price, availability, condition, brand, image_link, etc.).
- **Fuzz tests** : robustesse face aux entrées malformées.

Le rapport `docs/feed-produit/20-rapport-amelioration-CHA-225.md` consigne les améliorations livrées dans la branche actuelle (cf. dernier commit `61a03d2 feat: CHA-225 chat-lead webhook + product-feed + admin extensions`).

## 9. Conventions de réponse API

Schéma uniforme `lib/http/` :

```ts
// Succès
{ data: T, meta?: { /* pagination */ } }

// Erreur
{ error: {
  code: 'VALIDATION_ERROR' | 'RATE_LIMIT' | 'NOT_FOUND' | 'INTERNAL',
  message: string,
  details?: Record<string, string>
} }
```

Codes HTTP : 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500.

## 10. Synthèse — où vit la donnée

| Contenu | Source aujourd'hui | Source Phase 2 visée |
| --- | --- | --- |
| Pages B2C éditoriales | Mocks `data/mock/` | CMS (Sanity probable) via `lib/cms/` |
| Articles journal | Mocks `data/mock/articles.ts` | CMS |
| Produits + variantes | Mock unique (kit) + table `products` / `product_variants` partiellement peuplée | Table BDD pilotée par admin |
| SEO | `seo_settings` + `seo_overrides` opérationnels | Admin SEO + auto-generation OG |
| Médias | `public/` + table `media` | Vercel Blob (déjà autorisé en `remotePatterns`) + table `media` |
| Tracking events | `tracking_events_log` + matérialised views + `insights_*` | Identique, scaled |
| Knowledge chat | Markdown `content/chat-knowledge/` indexé pgvector | Identique avec CMS éventuel pour édition |
| Lead capture | `leads` + `lead_events` + webhooks chiffrés | Identique + intégration CRM externe |
| Components éditoriaux | `site_components` + `component_field_bindings` (draft/published) | Identique avec édition admin terminée |

Le découplage est donc déjà acquis pour les couches infra (médias, tracking, SEO, chat) ; il reste à finir l'admin UI pour rendre éditorialement autonome ce qui est techniquement déjà piloté par la BDD.
