# 01 · Vision & Architecture

> Pourquoi ce système, et comment les pièces s'articulent. À lire en premier après le README.

## 1. Vision produit

### 1.1 Le problème

L'admin actuel offre une **vue de configuration tracking** : quels pixels sont actifs, quels events sont déclarés, quels composants sont instrumentés. C'est nécessaire mais insuffisant.

Les questions que se pose une admin Marketing/Growth chaque jour ne reçoivent pas de réponse :

1. *Combien de visiteurs ont vu le produit aujourd'hui ? D'où viennent-ils ?*
2. *Mon CTA "Composer mon rituel" convertit-il mieux que la version précédente ?*
3. *Sur quelle étape du checkout les gens décrochent-ils ?*
4. *Mes campagnes Meta paient-elles plus que TikTok ?*
5. *J'ai poussé un fix vidéo hier — le `video_complete` se déclenche toujours quand il faut ?*

Un dashboard analytics dédié, ergonomique, segmentable, capable de répondre en < 3 clics.

### 1.2 Les principes

| Principe | Mise en œuvre |
|---|---|
| **Source unique** | Toutes les vues s'agrègent sur `tracking_events_log`. Pas de double comptage. |
| **Lecture rapide, ingestion intacte** | Vues matérialisées + index. La query d'un onglet doit rendre en < 300 ms (P95). |
| **Segmentation native** | Période × Device × Source = 3 dimensions filtrables partout. URL-driven pour partager une vue. |
| **Defaults brand-cohérents** | Mobile/Aujourd'hui/Tout (la marque vit majoritairement sur mobile au Maroc + Europe). |
| **Robustesse events** | Audit + règles d'idempotence avant d'afficher. Une donnée fausse = pire qu'aucune donnée. |
| **Anticipation A/B** | Schéma DB et events portent dès le départ un `experiment_id` optionnel. Aucune migration breaking dans 3 mois. |
| **Ergonomie martech** | Vocabulaire et conventions GA4 (event_name, eventcategory, items[], currency, value) pour permettre cross-check. |
| **Charte FemiGlow** | Palette stone-* en UI admin ; courbes en sauge/ciel/champagne/petale. Pas de néon, pas de gradients criards. |

### 1.3 Les 5 onglets — promesse en une phrase

| Onglet | Promesse |
|---|---|
| **Vue d'ensemble** | « Donne-moi en 5 secondes la santé de la boutique aujourd'hui, avec la possibilité de creuser. » |
| **Live** | « Que se passe-t-il maintenant ? Est-ce que ma campagne lancée à 14 h convertit ? » |
| **Funnel** | « Où mes visiteurs décrochent-ils ? Et est-ce que la page X est responsable ? » |
| **CTA** | « Quel CTA / page / message me ramène le plus d'achats par 1000 vues ? » |
| **Checkout & forms** | « Le checkout fuit-il ? Pourquoi ? À quel champ ? » |

## 2. Architecture système

### 2.1 Diagramme de flux

```
┌──────────────────────────┐
│ Browser (RSC + client)  │
│ ─ TrackingClient.emit() │
│ ─ window.dataLayer push │
└──────────┬───────────────┘
           │ POST /api/track  (batch ≤ 50, beacon ou fetch)
           ▼
┌──────────────────────────┐         ┌─────────────────────────┐
│ /api/track/route.ts      │────────▶│ Providers async         │
│ ─ rate limit 60/min/IP  │         │ ─ GA4, Meta, TikTok…   │
│ ─ schema validation     │         └─────────────────────────┘
│ ─ dedup (event_id LRU)  │
│ ─ consent gate          │
│ ─ enrich device/traffic │
└──────────┬───────────────┘
           │ INSERT
           ▼
┌──────────────────────────┐
│ tracking_events_log      │  ◀── source de vérité analytics
│ (1 row per event)        │
└──────────┬───────────────┘
           │
           │  ┌──────────────────────────────────────┐
           │  │  Cron refresh (15 min / 1 h)         │
           │  │  REFRESH MATERIALIZED VIEW … ;       │
           │  └──────────────────────────────────────┘
           ▼
┌──────────────────────────────────────────────────────┐
│  Vues matérialisées :                                │
│  ─ mv_overview_hourly  (KPI globaux par heure)      │
│  ─ mv_funnel_daily     (counts par stage et jour)   │
│  ─ mv_cta_performance  (clics→achats par CTA)        │
│  ─ mv_checkout_steps   (entrées/abandons par étape) │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────┐    ┌─────────────────────────┐
│ /api/admin/analytics/*   │◀──▶│ /admin/analytics/* RSC  │
│ ─ overview              │    │ ─ Tabs UI (5 onglets)   │
│ ─ live (SSE)            │    │ ─ FilterBar persistent  │
│ ─ funnel                │    │ ─ Recharts SVG          │
│ ─ cta                   │    │ ─ Skeletons + SWR       │
│ ─ checkout              │    └─────────────────────────┘
└──────────────────────────┘
```

### 2.2 Composants logiques

#### Couche **Ingest** (existante, non modifiée)
- `TrackingClient` (`apps/web/src/lib/tracking/client.ts`) : batching client → POST `/api/track`.
- `route.ts` (`apps/web/src/app/api/track/route.ts`) : valide, dédupe, log en DB, dispatche aux providers.
- **Enrichissement** ajouté en phase 1 : parsing UTM/referrer dans le payload, dérivation d'un champ `traffic_source` normalisé écrit dans `tracking_events_log.traffic_source` (nouvelle colonne).

#### Couche **Modèle** (extension légère)
- `tracking_events_log` : on ajoute 3 colonnes nullable : `traffic_source`, `traffic_medium`, `experiment_id`. Backfill non requis (NULL = "non attribué").
- 4 vues matérialisées (cf. `02-data-model.md`).
- 3 nouvelles tables A/B (cf. `02-data-model.md` §5) — créées dès maintenant pour figer la convention.
- Mapping `event_name → funnel_stage` ajouté à `tracking_event_definitions` (colonne `funnel_stage` enum nullable).

#### Couche **Query** (nouvelle)
- `apps/web/src/lib/analytics/queries/*.ts` — une fonction par KPI. Chaque fonction prend un objet `AnalyticsFilters` (period, device, traffic) et retourne un type sérialisable.
- `apps/web/src/lib/analytics/periods.ts` — résolution preset → `{ from, to }` UTC.
- `apps/web/src/lib/analytics/attribution.ts` — UTM/referrer → bucket source.
- `apps/web/src/lib/analytics/funnel-mapping.ts` — event_name → stage (en mémoire avec fallback DB).

#### Couche **API** (nouvelle, sous `/api/admin/analytics`)
- 5 routes principales (une par onglet) + 1 route SSE pour le Live.
- Toutes en `requireAdmin` ; toutes prennent les filtres dans le query string ; toutes renvoient JSON typé via Zod.

#### Couche **UI** (nouvelle, sous `/admin/analytics`)
- 1 layout (`AnalyticsShell`) qui gère :
  - L'onglet actif (sub-nav horizontale, segmented control).
  - La `FilterBar` partagée (period × device × traffic), sticky en haut.
  - L'état des filtres dans l'URL (`useSearchParams` côté client, `searchParams` côté server).
- 5 pages RSC, une par onglet.
- Composants partagés (`KpiCard`, `LineChart`, `BarChart`, `Sankey`, `FunnelChart`, `LiveCounter`, `EventStreamFeed`).

### 2.3 Choix techniques motivés

#### Recharts vs alternatives

| Lib | Pour | Contre | Verdict |
|---|---|---|---|
| **Recharts** | Composé déclaratif React, SVG, ~30 KB gz, brand-friendly | Pas de WebGL, perfs limitées > 10 k points | ✅ **Choisi** |
| Tremor | Defaults superbes, hooks built-in | Bundle plus lourd, opinions fortes (palette imposée), limites de customisation | ❌ |
| visx | Très flexible | Bas niveau → coût d'écriture | ❌ |
| Chart.js | Mature | Canvas (a11y plus dure), wrappers React = obsolètes | ❌ |
| ApexCharts | Riche | 90 KB gz, opinions | ❌ |

Recharts couvre 100 % de nos besoins (line, bar, area, pie pour traffic, Sankey via `@nivo/sankey` à part). On garde la possibilité d'ajouter `@nivo/sankey` si Recharts ne suffit pas pour le funnel↔pages.

#### Polling SWR vs WebSocket vs SSE

| Approche | Pour | Contre | Verdict |
|---|---|---|---|
| Polling SWR (5 s) | Simple, RSC-compatible, cache built-in | Latence 0–5 s, charge serveur | ✅ pour KPI Live qui n'ont pas besoin d'instantané |
| WebSocket | Push instantané | Vercel = pas de support natif, infra séparée | ❌ |
| **SSE** | Push, HTTP standard, marche sur Vercel Edge | Connexion unidirectionnelle (suffit ici) | ✅ **complément** pour 3 compteurs critiques (online users, conversions, CTA) |

Stratégie : **SWR partout** pour la majorité des données Live (rafraîchies à 5 s), **SSE** uniquement sur les 3 compteurs où la perception "instantanée" compte. Si SSE échoue → fallback SWR (graceful degrade).

#### Vue matérialisée vs requête live

| Approche | Pour | Contre | Verdict |
|---|---|---|---|
| Live SQL | Données fraîches | À 100 k events/jour, certaines queries coûtent > 2 s | OK pour onglet Live (range serré) |
| Vue matérialisée | < 50 ms en lecture | Décalage de 15 min ou 1 h | ✅ pour Vue d'ensemble, Funnel, CTA, Checkout |

Hybride : vue matérialisée pour les ranges ≥ 1 jour ; live SQL pour "Aujourd'hui" et "Live".

#### Drizzle vs SQL brut

L'existant utilise Drizzle. On le garde pour les queries simples. Pour les agrégats complexes (window functions, CTEs), on écrit du **SQL brut via `db.execute(sql\`...\`)`** — Drizzle le permet, et le SQL brut sera plus lisible que une chaîne de chained methods.

### 2.4 Contraintes & non-buts

#### Contraintes
- **RGPD** : aucun KPI ne distingue les utilisateurs sans consentement `analytics_storage`. La table `tracking_events_log` filtre déjà à l'ingest ; on s'aligne.
- **Vercel** : pas de WebSocket natif. SSE OK. Pas de cron natif < 1/min. → on utilise un cron `/api/cron/refresh-analytics-views` invoqué par Vercel Cron (déjà configuré dans `vercel.json`).
- **Multi-devises** : `tracking_events_log.payload.value` est en unité majeure (cf. catalogue events). On normalise en MAD au niveau du KPI **revenue** uniquement (table de change `currency_rates` à introduire — défaut hardcoded MAD pour MVP).
- **Pas de PII en clair** : aucun email, IP brute, fingerprint dans les KPI. Si un agrégat révèle indirectement un utilisateur (cas extrême : 1 seule conversion sur un range), masquer en "< 5".

#### Non-buts (volontaires, hors scope V1)
- **Pas de cohort analysis** ni rétention multi-mois (V2).
- **Pas d'attribution multi-touch** (Markov, Shapley) — last-non-direct seulement (V2).
- **Pas de prédictif** (LTV prédite, scoring de leads) — V3.
- **Pas de comparaison de périodes** ("vs période précédente") — V1.5.
- **Pas d'export brut** des events_log au-delà de l'admin tracking existant.

## 3. Découpage fonctionnel

### 3.1 Modules (par domaine)

```
apps/web/src/
├── app/
│   ├── admin/analytics/
│   │   ├── layout.tsx               # AnalyticsShell + FilterBar
│   │   ├── page.tsx                 # → redirige /overview
│   │   ├── overview/page.tsx        # onglet (a)
│   │   ├── live/page.tsx            # onglet (b)
│   │   ├── funnel/page.tsx          # onglet (c)
│   │   ├── cta/page.tsx             # onglet (d)
│   │   └── checkout/page.tsx        # onglet (e)
│   └── api/admin/analytics/
│       ├── overview/route.ts
│       ├── live/route.ts            # SSE
│       ├── funnel/route.ts
│       ├── cta/route.ts
│       └── checkout/route.ts
├── components/admin/analytics/
│   ├── AnalyticsShell.tsx           # wrap AdminShell + sub-nav
│   ├── FilterBar.tsx                # period × device × traffic
│   ├── KpiCard.tsx                  # tile chiffre + delta
│   ├── KpiGrid.tsx                  # responsive grid de cards
│   ├── charts/
│   │   ├── LineChart.tsx            # wrappers Recharts brandés
│   │   ├── BarChart.tsx
│   │   ├── AreaChart.tsx
│   │   ├── DonutChart.tsx
│   │   ├── FunnelChart.tsx          # bars horizontales custom
│   │   └── SankeyChart.tsx          # @nivo/sankey si besoin
│   ├── live/
│   │   ├── LiveCounter.tsx          # SSE-bound
│   │   ├── EventStreamFeed.tsx      # tail des events
│   │   └── OnlineUsersGauge.tsx
│   ├── funnel/
│   │   ├── FunnelDiagram.tsx
│   │   └── FunnelPagesMatrix.tsx
│   ├── cta/
│   │   └── CtaPerformanceTable.tsx
│   └── checkout/
│       └── CheckoutFunnelDiagram.tsx
└── lib/analytics/
    ├── periods.ts                   # presets → { from, to }
    ├── attribution.ts               # utm/referrer → bucket
    ├── funnel-mapping.ts            # event → stage
    ├── filters.ts                   # types AnalyticsFilters + zod schema
    ├── queries/
    │   ├── overview.ts
    │   ├── live.ts
    │   ├── funnel.ts
    │   ├── cta.ts
    │   └── checkout.ts
    └── revalidate.ts                # refresh des matviews
```

### 3.2 Frontière server / client

- **Server (RSC)** : pages, layouts, fetch des KPI initiaux (premier render = SSR avec données fraîches).
- **Client** : `FilterBar` (manipule `useSearchParams`), `LiveCounter` (SSE / SWR), `Recharts` (SVG mais doit être client pour interaction tooltip).
- **Pattern** : la page RSC `await query()` → passe les données au composant client `<KpiGrid initial={data}>` ; le client fait du SWR à partir de `initial` pour rafraîchir si filtres changent.

## 4. Cycle de vie d'une page analytics (séquence)

> Exemple : utilisateur ouvre `/admin/analytics/overview?period=today&device=mobile`.

1. **RSC `layout.tsx`** lit `searchParams`, valide via Zod (`AnalyticsFiltersSchema.parse`).
2. **RSC `overview/page.tsx`** appelle en parallèle 6 queries (`getKpiSessions`, `getKpiVisitors`, …) qui chacune pointent sur `mv_overview_hourly` filtrée + `tracking_events_log` filtrée pour les KPI live.
3. Les données sont passées en props à `<OverviewClient initial={data}>`.
4. **Côté client**, `<FilterBar>` est monté avec l'état initial. À chaque changement utilisateur :
   - `router.replace('/admin/analytics/overview?period=…&device=…')` (Next.js shallow update).
   - SWR détecte le changement de clé et refetch l'API `/api/admin/analytics/overview?…`.
   - Skeleton affiché pendant la requête.
5. **Tracking de l'admin lui-même** : chaque changement de filtre émet un `fg_admin_action` (`{ action: 'analytics.filter_change', resource: 'overview', payload: filters }`) — utile pour comprendre l'usage.

## 5. Sécurité & accès

- Toutes les routes sont protégées par `requireAdmin('/admin/analytics/...')` (cookie `iron-session`).
- L'API `/api/admin/analytics/*` exige le même cookie ; renvoie 401 sinon.
- Pas de CORS large : les routes API ne sont pas appelables depuis le frontend public.
- Logs d'audit : tout export ou changement de range custom > 1 an logge un `fg_admin_action` avec le mail admin.

## 6. Ce qu'on garde de l'existant

| Existant | Statut | Pourquoi |
|---|---|---|
| `TrackingClient` (client.ts) | **Inchangé** | Fait son job : batch + beacon + dedup. |
| `/api/track` | **Étendu** (enrichissement traffic_source) | On lui ajoute 5 lignes pour parser UTM. |
| `event-catalog.ts` | **Étendu** (champ funnel_stage) | Ajout colonne, pas de breaking. |
| `tracking_events_log` | **Étendu** (3 colonnes nullable) | Migration additive. |
| `/admin/tracking/*` | **Conservé tel quel** | Reste l'outil de config — pas confondre avec analytics. |
| AdminShell | **Étendu** (1 entrée NAV) | `'analytics'` ajouté à la union et à NAV. |

## 7. Ce qui sera créé

- 1 onglet de navigation admin.
- 1 layout `AnalyticsShell` + 5 pages.
- 5 routes API + 1 route SSE.
- 1 cron `refresh-analytics-views` (toutes les 15 min).
- 4 vues matérialisées + 3 tables A/B + 1 colonne sur `tracking_event_definitions` + 3 colonnes sur `tracking_events_log`.
- 12 composants UI partagés (`AnalyticsShell`, `FilterBar`, `KpiCard`, `KpiGrid`, 5 charts, 3 live components).
- 5 fichiers de queries (`overview.ts`, `live.ts`, `funnel.ts`, `cta.ts`, `checkout.ts`).
- 4 utilitaires (`periods.ts`, `attribution.ts`, `funnel-mapping.ts`, `filters.ts`).
- ~30 tests unitaires + ~15 tests intégration MSW + ~6 tests Playwright.

## 8. Métriques de succès du système lui-même

| Métrique | Cible V1 |
|---|---|
| Latence page (`/admin/analytics/overview` SSR) | P95 < 1 s |
| Latence API (`/api/admin/analytics/*`) | P95 < 300 ms |
| Couverture tests (lignes, lib/analytics + components/admin/analytics) | > 80 % |
| Bundle JS additionnel (admin only) | < 90 KB gz (Recharts inclus) |
| Adhérence charte (lint a11y axe + visual reg Playwright) | 0 violation critique |

---

**Suivant** → [`02-data-model.md`](02-data-model.md) : schéma DB, vues matérialisées, anticipation A/B.
