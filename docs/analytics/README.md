# Analytics FemiGlow — Dossier de conception

> Plan complet pour le système d'analytics admin `/admin/analytics` : 5 onglets stratégiques (Vue d'ensemble, Live, Funnel, CTA, Checkout), prêt pour extension A/B native.

## Pourquoi ce dossier

L'admin actuel (`/admin/tracking/*`) est un outil de **configuration** (déclaration des pixels, inventaire des composants, logs bruts). Il ne répond pas à la question business : *« qu'est-ce qui marche ? qu'est-ce qui décroche ? »*.

Ce dossier décrit un **deuxième admin parallèle** dédié à la **lecture** : KPI, séries temporelles, funnel, attribution CTA, comportement formulaire, A/B (à venir). Il s'appuie 100 % sur l'infra de tracking existante (`tracking_events_log`, `event-catalog.ts`, `TrackingClient`) — pas de réécriture.

## TL;DR — décisions structurantes

| Sujet | Décision | Pourquoi |
|---|---|---|
| **Source de vérité** | `tracking_events_log` (table existante) + 4 vues matérialisées | Évite la duplication. Les vues servent les agrégats coûteux (sessions, funnel) à coût de query maîtrisé. |
| **Charting** | Recharts | RSC-compatible, ~30 KB gz, brand-friendly (couleurs custom faciles), pas de canvas → SVG accessible. |
| **Live** | Polling SWR 5 s + SSE (Server-Sent Events) sur 3 compteurs critiques | WebSocket = overkill et coûteux sur Vercel ; SSE est suffisant pour push « online users » et conversions live. |
| **Period filter** | Aujourd'hui · Hier · 7j · 30j · 90j · Tout · Custom | Présets standards GA4. URL-driven (`?from=2026-04-01&to=2026-05-06`) pour partage. |
| **Device filter** | Mobile · Tablette · Ordinateur · Tout | Source : `tracking_events_log.device` (déjà parsé via UA à l'ingest). |
| **Traffic filter** | Direct · Google · Meta · TikTok · Snap · Pinterest · Email · Affilié · Autre · Tout | Normalisation via `lib/analytics/attribution.ts` (UTM source/medium → bucket). |
| **Defaults** | Mobile · Aujourd'hui · Tout traffic | Conforme à la demande. Persistés en `localStorage` (clé `fg_analytics_filters`). |
| **Funnel TOF/MOF/BOF** | Mapping events → stage stocké en DB (`tracking_event_definitions.funnel_stage`) | Édition admin sans deploy. Préset commit-able dans la migration. |
| **A/B testing** | Tables `experiments`, `experiment_variants`, `experiment_assignments` créées **dès la phase 1** | Les assignations apparaissent dans `tracking_events_log.payload.experiment_id`. Jamais besoin de migration breaking plus tard. |
| **Audit vidéo** | Distinguer `video_autoplay_view` (passif, non comptabilisé en engagement) vs `video_user_play` (actif) + audit script | Résout le « les events vidéo se déclenchent seuls » remonté par l'utilisateur. |

## Navigation

Les fichiers sont numérotés pour une lecture séquentielle, mais chacun est autonome (introduction + schéma + détail + tests). Lire dans l'ordre la première fois ; revenir au fichier ciblé ensuite.

| # | Fichier | Quand le lire |
|---|---|---|
| 0 | `README.md` *(ici)* | Toujours, en premier. |
| 1 | [`01-vision-architecture.md`](01-vision-architecture.md) | Avant de toucher au code. Diagramme système, flux ingest → query, choix tech motivés. |
| 2 | [`02-data-model.md`](02-data-model.md) | Avant les migrations DB. Tables existantes + 4 vues matérialisées + 3 tables A/B (anticipation). |
| 3 | [`03-events-funnel-audit.md`](03-events-funnel-audit.md) | Avant de toucher aux events. Catalogue mappé TOF/MOF/BOF, audit vidéo + plan de fix robustesse. |
| 4 | [`04-ui-design.md`](04-ui-design.md) | Avant les composants. Tokens admin, primitives partagées (Tabs, KpiCard, FilterBar, ChartFrame, Skeleton). |
| 5 | [`05-onglets-specs.md`](05-onglets-specs.md) | Pendant l'impl. Specs détaillées des 5 onglets (KPI list, queries SQL/Drizzle, layouts, edge cases). |
| 6 | [`06-tests-strategy.md`](06-tests-strategy.md) | Pendant l'impl. Patterns Vitest + MSW + Playwright + scénarios par onglet. |
| 7 | [`07-runbook-roadmap.md`](07-runbook-roadmap.md) | Avant chaque phase. Plan d'action M0→M6, runbook prod, troubleshooting. |

## Demandes utilisateur cartographiées

> *Pour traçabilité : où chaque sous-demande (a..g) est traitée.*

| Demande | Document principal | Sections clés |
|---|---|---|
| **(a)** Vue d'ensemble — KPI segmentés période/device/traffic, courbes temporelles, defaults Mobile/Aujourd'hui/Tout | `05-onglets-specs.md` §1 | KPI list, FilterBar, layout `grid-cols-12`, queries 6 KPI |
| **(b)** Live — online users, conversions 1/2/3h, CTA achat, par page, datalayer flow, sources, devices, funnel TOF/MOF/BOF live | `05-onglets-specs.md` §2 | SSE design, polling fallback, mosaïque 3×3 |
| **(c)** Funnel — étapes, taux d'abandon par période, lien funnel↔pages, filtres device/traffic | `03-events-funnel-audit.md` §3 + `05-onglets-specs.md` §3 | Mapping stages, vue matérialisée `mv_funnel_daily`, Sankey funnel↔pages |
| **(d)** CTA — quels CTA convertissent, quelles pages/messages mènent à l'achat, segmentation | `05-onglets-specs.md` §4 | `tracking_components` join `tracking_events_log`, taux clic→achat par CTA |
| **(e)** Checkout/Forms — visites, initiate, abandons, soumission, erreurs, temps formulaire | `05-onglets-specs.md` §5 | Funnel checkout fin, instrumentation form_field_focus/blur, distribution time-to-submit |
| **(f)** A/B testing — anticiper l'extension | `02-data-model.md` §5 + `10-ab-testing-extension.md` *(stub)* | Schéma tables expérimentations + colonne `payload.experiment_id` dans events_log |
| **(g)** Robustesse events (vidéos qui se déclenchent seuls) | `03-events-funnel-audit.md` §4 | Audit vidéo détaillé, distinction autoplay/user_play, règles d'idempotence pour tous les events |

## Glossaire express

| Terme | Définition |
|---|---|
| **TOF / MOF / BOF** | Top / Middle / Bottom of Funnel — étape macro du funnel d'acquisition. |
| **Conversion rate (CR)** | `purchases / sessions`. Pour FemiGlow, primaire = achat ; secondaire = lead/newsletter. |
| **AOV** | Average Order Value — `revenue / orders`. |
| **Bounce rate** | % sessions à 1 page-vue et < 10 s. Calculé côté server à partir de `page_view` + timestamps de session. |
| **Attribution** | Modèle qui décide à quelle source attribuer la conversion. Par défaut : last-non-direct click. |
| **Vue matérialisée** | Table dérivée pré-calculée. Rafraîchie en cron (15 min pour `mv_overview_hourly`, 1 h pour `mv_funnel_daily`). |
| **DataLayer** | Buffer client `window.femiglowDataLayer` qui expose les events au debug et à GTM (passthrough `window.dataLayer`). |
| **Idempotence d'event** | Garantie qu'un même event utilisateur ne soit comptabilisé qu'une fois (guards `*Fired.current`, `event_id` unique côté ingest). |

## Conventions transverses du dossier

- Code en **TypeScript strict** ; SQL formaté en majuscules pour les keywords.
- Toutes les requêtes admin sont en **server components RSC** ; le client n'a accès qu'aux endpoints `/api/admin/analytics/*` (auth `requireAdmin`).
- Tous les composants UI suivent les **tokens admin** (`stone-*` Tailwind) sauf les couleurs de courbes (palette brand : sauge/ciel/champagne/petale).
- Aucun token d'API tiers en clair côté client. Les pixels GA4/Meta/etc. continuent d'être servis via `tracking_providers` (pattern existant).
- Tous les events ajoutés sont **catalogués** dans `event-catalog.ts` ; aucun event « sauvage » n'est admis.
