# 01 — Architecture & flux de données

## 1. Vue d'ensemble

Les 4 onglets partagent un **layout commun** (`app/admin/analytics/layout.tsx`) qui rend
`AdminShell` → `AnalyticsTabs` → `FilterBar` → `children`. Chaque onglet est une **page RSC**
(`force-dynamic`, `revalidate=0`) qui pré-charge ses données via `lib/analytics/queries/*` puis
délègue à un **Dashboard client** qui (devrait) refetch via `app/api/admin/analytics/*` quand les
filtres changent.

```
URL ?period&device&traffic[&from&to]
      │
      ▼
app/admin/analytics/<tab>/page.tsx  (RSC, force-dynamic)
      │  parseFiltersFromSearchParams (Zod) → AnalyticsFilters
      │  await get<Tab>Data(filters)            ← pré-chargement serveur
      ▼
<Tab>Dashboard (client)   ──useEffect──►  GET /api/admin/analytics/<tab>?<filters>
      │                                          │ getAdminSession (auth)
      │                                          │ parseFiltersFromSearchParams
      │                                          ▼ get<Tab>Data(filters)
      ▼                                   lib/analytics/queries/<tab>.ts
   primitives (KpiCard, DataTable, ChartFrame, EmptyState, ErrorState…)
                                                 │ resolveRange(filters) → {from,to}
                                                 │ fetchEvents()  ← consent gate + period + device + traffic
                                                 ▼
                                          tracking_events_log  (ou memoryStore en dev/test)
```

> **Insights** est l'exception : il a son **propre** pipeline (filtres `window/env/device/locale/
> trafficSource`, fetch via `useInsightsFetch`, données issues de **materialized views**
> rafraîchies par cron), monté **à l'intérieur** du même layout (d'où la double `FilterBar`).

## 2. Source de données

| Table | Rôle | Colonnes clés exploitées |
|---|---|---|
| `tracking_events_log` | Journal des events web (client + serverFire) | `event_name`, `session_id`, `anonymous_id`, `page_route`, `component_id`, `received_at`, `device`, `traffic_source`, `consent_snapshot`, `payload`, `is_conversion` |
| `tracking_components` | Catalogue des composants trackés (pour CTA) | `id`, `name`, `category`, `default_params`, `deleted_at` |
| `mv_*` (insights) | Materialized views agrégées | rafraîchies par `lib/analytics/insights/refresh.ts` (cron/manuel) |

**Consent gate** (toutes les queries) : seuls les events `consent_snapshot->>'analytics_storage' =
'granted'` sont comptés. Conséquence : sous-comptage volontaire du trafic non-consenti — **à
expliciter dans l'UI** (sinon l'opérateur croit voir 100 % du trafic).

## 3. Modèle « session » (Funnel & Checkout)

`aggregateSessions(events)` réduit la liste d'events en `Map<sessionId, flags>` :
- tri **ASC** par `receivedAt` → `firstPage` = page du 1er event.
- chaque flag d'étape = **OR** logique (présence d'au moins un event de l'étape).
- timestamps min par étape conservés (pour `medianTimeToNextSeconds` / time-to-submit).

Deux interprétations divergent ensuite (cf. AF-03) :
- **Funnel** : reconstruit un **cumul strict** (`reached[cta] = view ∧ engage ∧ cta`).
- **Checkout** : compte chaque étape **telle quelle** (pas de cumul) → progression > 100 % possible.

## 4. Modèle « attribution » (CTA)

`attributePurchases(events, from, to)` : pour chaque `purchase` dans `[from,to]`, recherche le
**dernier `cta_click`** (1) dans la même session avant l'achat, sinon (2) le dernier du même
`anonymous_id` dans les **7 j** précédents. La fenêtre de fetch est élargie à `from − 7 j`.
Last-click strict : 1 CTA crédité par achat.

## 5. Réactivité client (le point sensible)

| Onglet | Lecture des filtres après mount | Refetch sur changement | Statut |
|---|---|---|---|
| Funnel | `useState(initialFilters)` figé | `useEffect([filters])` jamais redéclenché | 🔴 cassé (AF-01) |
| CTA | idem | idem | 🔴 cassé (AF-01) |
| Checkout | idem | idem | 🔴 cassé (AF-01) |
| Insights | `useInsightsFilters` → `useSearchParams` (réactif) | `useInsightsFetch(url)` refetch sur URL | 🟢 correct |

La `FilterBar` écrit bien l'URL (`useAnalyticsFilters.setFilters` → `router.replace`). Mais sur les
3 premiers onglets, le Dashboard ne **relit pas** l'URL : `useState` ne capture la valeur qu'au
1er rendu et ignore les nouvelles props sur re-render (pas de remount sur navigation soft). Le
module Insights prouve que le pattern correct est connu dans la base de code.

## 6. Diagrammes

- [`diagrams/flux-analytics.puml`](diagrams/flux-analytics.puml) — séquence RSC → API → query → DB.
- [`diagrams/bug-reactivite-filtres.puml`](diagrams/bug-reactivite-filtres.puml) — le chemin cassé
  d'AF-01 vs le chemin correct d'Insights.
