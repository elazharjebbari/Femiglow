# 10 — Catalogue exhaustif des fonctionnalités analytics

Énumération **sans exception** de tout ce qui compose les 4 onglets (et leurs dépendances
transverses), pour qu'aucune fonctionnalité ne soit oubliée par la batterie de tests. Chaque entrée
a un **ID** repris dans `catalogue.csv` et la `matrice-couverture.csv`.

> Convention d'ID : `FN-<SYS>-<n>` où SYS ∈ {LAY (layout/transverse), FUN, CTA, CHK, INS}.

## 1. Layout & transverse (LAY)

| ID | Fonctionnalité | Fichier | Comportement attendu (résumé) |
|---|---|---|---|
| FN-LAY-01 | AdminShell + garde auth | `analytics/layout.tsx`, `requireAdmin` | Redirige si non-admin ; affiche email |
| FN-LAY-02 | AnalyticsTabs (navigation onglets) | `primitives/AnalyticsTabs.tsx` | Onglet actif `aria-current` ; conserve les query params au switch |
| FN-LAY-03 | FilterBar — période | `primitives/FilterBar.tsx` | 7 valeurs ; custom from/to ; écrit l'URL |
| FN-LAY-04 | FilterBar — device | idem | mobile/tablet/desktop/all ; **défaut mobile** |
| FN-LAY-05 | FilterBar — source/traffic | idem | all + buckets ; écrit l'URL |
| FN-LAY-06 | FilterBar — reset | idem | apparaît hors défaut ; remet DEFAULT_FILTERS |
| FN-LAY-07 | Persistance filtres (localStorage TTL 30 j) | `filters.ts`, `useAnalyticsFilters` | Hydrate si URL vide ; re-valide ; ignore si expiré |
| FN-LAY-08 | Parsing/validation filtres (Zod) | `filters.ts` | Enum ; custom from<to ≤366 j ; fallback sur invalide |
| FN-LAY-09 | resolveRange (period → from/to + comparaison) | `filters.ts` | Bornes correctes par période ; **fuseau** (AF-04) |
| FN-LAY-10 | Formatage (number/percent/duration/currency/delta/bucket) | `format.ts` | FR ; null→"—" ; devise ; granularité |
| FN-LAY-11 | Classification trafic | `attribution.ts` | utm/referrer → bucket |
| FN-LAY-12 | Primitive KpiCard | `primitives/KpiCard.tsx` | valeur, delta, état loading |
| FN-LAY-13 | Primitive DataTable | `primitives/DataTable.tsx` | tri, colonnes, vide, loading |
| FN-LAY-14 | Primitive ChartFrame | `primitives/ChartFrame.tsx` | titre, légende, conteneur |
| FN-LAY-15 | Primitive EmptyState | `primitives/EmptyState.tsx` | message « aucune donnée » |
| FN-LAY-16 | Primitive ErrorState | `primitives/ErrorState.tsx` | message d'erreur + retry |
| FN-LAY-17 | Primitive Skeleton | `primitives/Skeleton.tsx` | placeholder loading |
| FN-LAY-18 | Primitive ExportCsvButton | `primitives/ExportCsvButton.tsx` | génère CSV de la vue |
| FN-LAY-19 | Primitive AnalyticsTooltip | `primitives/AnalyticsTooltip.tsx` | tooltip accessible clavier |

## 2. Onglet Funnel (FUN)

| ID | Fonctionnalité | Fichier |
|---|---|---|
| FN-FUN-01 | Page RSC pré-chargement (overview+sankey+byPage) | `funnel/page.tsx` |
| FN-FUN-02 | FunnelDashboard (orchestration client + refetch) | `funnel/FunnelDashboard.tsx` |
| FN-FUN-03 | FunnelGlobal (5 étapes, sessions, progression) | `funnel/FunnelGlobal.tsx` |
| FN-FUN-04 | FunnelDropOff (drop-off par étape) | `funnel/FunnelDropOff.tsx` |
| FN-FUN-05 | FunnelByPageSankey (flux first_page → étape max) | `funnel/FunnelByPageSankey.tsx` |
| FN-FUN-06 | FunnelDataTable (par page d'entrée) | `funnel/FunnelDataTable.tsx` |
| FN-FUN-07 | Query getFunnelOverview (steps + médianes) | `queries/funnel.ts` |
| FN-FUN-08 | Query getFunnelByPage | `queries/funnel.ts` |
| FN-FUN-09 | Query getFunnelSankey (top 20 + Autres + truncated) | `queries/funnel.ts` |
| FN-FUN-10 | API GET /funnel (+ view=table) | `api/.../funnel/route.ts` |
| FN-FUN-11 | API GET /funnel/sankey | `api/.../funnel/sankey/route.ts` |
| FN-FUN-12 | Classification d'étape (view/engage/cta/checkout/purchase) | `queries/funnel.ts` |
| FN-FUN-13 | aggregateSessions + médiane time-to-next | `queries/funnel.ts` |

## 3. Onglet CTA (CTA)

| ID | Fonctionnalité | Fichier |
|---|---|---|
| FN-CTA-01 | Page RSC (getCtaData) | `cta/page.tsx` |
| FN-CTA-02 | CtaDashboard (refetch) | `cta/CtaDashboard.tsx` |
| FN-CTA-03 | CtaKpiGrid (impressions/clics/conv/revenu) | `cta/CtaKpiGrid.tsx` |
| FN-CTA-04 | CtaTable (par component_id, isDeleted) | `cta/CtaTable.tsx` |
| FN-CTA-05 | CtaTopMessages (par label) | `cta/CtaTopMessages.tsx` |
| FN-CTA-06 | CtaTopPages (par page_route) | `cta/CtaTopPages.tsx` |
| FN-CTA-07 | Query getCtaData (totals/rows/topMessages/topPages) | `queries/cta.ts` |
| FN-CTA-08 | attributePurchases (last-click + fallback 7 j) | `queries/cta.ts` |
| FN-CTA-09 | Lecture valeur/revenu (unité) | `queries/cta.ts` |
| FN-CTA-10 | fetchComponents (labels, deletedAt) | `queries/cta.ts` |
| FN-CTA-11 | API GET /cta | `api/.../cta/route.ts` |

## 4. Onglet Checkout (CHK)

| ID | Fonctionnalité | Fichier |
|---|---|---|
| FN-CHK-01 | Page RSC (getCheckoutData) | `checkout/page.tsx` |
| FN-CHK-02 | CheckoutDashboard (refetch) | `checkout/CheckoutDashboard.tsx` |
| FN-CHK-03 | CheckoutKpiGrid (viewCart/begin/submissions/abandons/serverFallback) | `checkout/CheckoutKpiGrid.tsx` |
| FN-CHK-04 | CheckoutFunnelStepper (6 étapes) | `checkout/CheckoutFunnelStepper.tsx` |
| FN-CHK-05 | CheckoutTimeToSubmit (histogramme + percentiles) | `checkout/CheckoutTimeToSubmit.tsx` |
| FN-CHK-06 | CheckoutFormErrors (top erreurs champ/code) | `checkout/CheckoutFormErrors.tsx` |
| FN-CHK-07 | CheckoutAbandonedFields (top dernier champ) | `checkout/CheckoutAbandonedFields.tsx` |
| FN-CHK-08 | Query getCheckoutData | `queries/checkout.ts` |
| FN-CHK-09 | classifyEvent + aggregateSessions (submit implicite, server) | `queries/checkout.ts` |
| FN-CHK-10 | buildTimeToSubmit (buckets 50 s, P25/50/75/95, filtres bot/outlier) | `queries/checkout.ts` |
| FN-CHK-11 | Calcul abandons (fenêtre 60 min) | `queries/checkout.ts` |
| FN-CHK-12 | API GET /checkout | `api/.../checkout/route.ts` |

## 5. Onglet Insights (INS)

| ID | Fonctionnalité | Fichier |
|---|---|---|
| FN-INS-01 | InsightsView (orchestration, onglets internes) | `insights/InsightsView.tsx` |
| FN-INS-02 | FiltersBar Insights (window/env/device/locale/trafficSource + custom) | `insights/InsightsView.tsx` |
| FN-INS-03 | useInsightsFilters (URL réactive) | `insights/useInsights.ts` |
| FN-INS-04 | useInsightsFetch (refetch sur URL) | `insights/useInsights.ts` |
| FN-INS-05 | Overview (KPIs + variations + timeseries + heatmap + topEvents) | `api/.../insights/overview` |
| FN-INS-06 | Pages (table) + drill-down page | `api/.../insights/pages`, `pages/[route]` |
| FN-INS-07 | Components (table) + dead components + drill-down | `api/.../insights/components`, `[id]` |
| FN-INS-08 | Sections (dwell time) | `api/.../insights/sections` |
| FN-INS-09 | Funnel insights (stages, dropoffs, revenue, purchasers) | `api/.../insights/funnel` |
| FN-INS-10 | InsightsCharts (timeseries/heatmap/charts) | `insights/InsightsCharts.tsx` |
| FN-INS-11 | InsightsDrawer (drill-down) | `insights/InsightsDrawer.tsx` |
| FN-INS-12 | Refresh matview (status, lock, durations, firstRun) | `api/.../insights/refresh`, `refresh.ts` |
| FN-INS-13 | Settings (enabled, intervalMinutes) | `api/.../insights/settings`, `settings.ts` |
| FN-INS-14 | Export CSV (par view) | `api/.../insights/export`, `exports.ts` |
| FN-INS-15 | Export PNG | `insights/ExportPngButton.tsx`, `png-export.ts` |
| FN-INS-16 | Purge / rétention | `insights/purge.ts` |
| FN-INS-17 | Audit log Insights | `insights/audit.ts` |
| FN-INS-18 | aggregate/services (calcul KPIs) | `insights/aggregate.ts`, `services.ts` |

## 6. Totaux

- **19** fonctionnalités transverses + **13** Funnel + **11** CTA + **12** Checkout + **18**
  Insights = **73 fonctionnalités** cataloguées.
- Voir `catalogue.csv` (machine-readable) et `matrice-couverture.csv` (feature × niveau de test).
