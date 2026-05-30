# 05 — Système Insights (`/admin/analytics/insights`)

Fichiers : `lib/analytics/insights/{contracts,aggregate,services,refresh,exports,settings,purge,
png-export,format,filters,parse-filters,audit}.ts` · `lib/analytics/matviews.ts` ·
`app/api/admin/analytics/insights/{overview,pages,pages/[route],components,components/[id],
sections,funnel,export,refresh,settings}/route.ts` ·
`components/admin/analytics/insights/{InsightsView,InsightsCharts,InsightsDrawer,ExportPngButton,
useInsights}.tsx`.

> C'est le module le plus riche : un mini-produit analytique basé sur des **materialized views**
> rafraîchies par cron, avec drill-down, exports et réglages. **Mieux architecturé** que les 3
> autres onglets côté réactivité (sert de référence pour AF-01).

## 1. Fonctionnement optimal

Vues exposées (`INSIGHTS_EXPORT_VIEWS`) : **overview, events, pages, components, dead_components,
sections, funnel**.

- **Overview** : KPIs (`totalEvents`, `uniqueSessions`, `pageViews`, `conversions`,
  `avgEventsPerSession`, `bounceRate`) + **variations** vs période précédente + **timeseries** +
  **heatmap** (heure × jour de semaine) + **top events** + `refreshedAt` + `firstRun`.
- **Pages** : table (pageViews, sessions, visitors, scroll75, conversions, bounce, avgTime) +
  **drill-down** `pages/[route]` (events, components, daily).
- **Components** : table + `dead_components` (composants sans event = candidats à suppression) +
  drill-down `components/[id]`.
- **Sections** : dwell time par section.
- **Funnel** : stages + dropoffs + `totalRevenueCents` + `uniquePurchasers`.
- **Refresh** : matviews rafraîchies (`trigger: cron|manual`, `status`, `lock`, `durationsMs`,
  `counts`) ; **settings** `enabled` + `intervalMinutes ∈ {5,10,15,30,60}`.
- **Exports** : **CSV** (par view) + **PNG** (`ExportPngButton`, capture du graphe).

Filtres propres : `window` (today…all/custom), `env`, `device`, `locale`, `trafficSource`.

## 2. Justesse & robustesse — analyse

✅ **Réactivité correcte** : `useInsightsFilters` lit l'URL (`useSearchParams` + `useMemo`),
`useInsightsFetch(url)` refetch sur changement (`useInsights.ts`). **Modèle de référence.**

✅ **Matviews + lock** : `refresh.ts` gère un verrou (pas de refresh concurrent), un statut
(`running/success/failed/skipped`), des durées/counts par étape, et `firstRun` (matview jamais
peuplée) → l'UI peut afficher « première exécution requise ».

✅ **Contrats Zod** sur toutes les routes (`insightsFiltersSchema`, `insightsSettingsPatchSchema`).
Bornes custom 365 j.

🟠 **AF-05 (double barre de filtres)** : `InsightsView.tsx:67` rend sa propre `<FiltersBar>` **en
plus** de la `FilterBar` du layout (`period/device/traffic`). Deux barres aux **modèles différents**
(`window` vs `period`, `trafficSource` vs `traffic`) cohabitent → confusion ; les deux écrivent des
**clés URL distinctes** sans se synchroniser. La FilterBar du layout n'a **aucun effet** sur
Insights (qui ignore `period`).

⚠️ **F-INS-02 (fraîcheur des données)** : les chiffres viennent des matviews, donc **en retard**
du `intervalMinutes` configuré. Si l'opérateur compare Insights (matview, ex. il y a 15 min) et
Funnel/Checkout (live, scan direct), il verra des **écarts normaux mais déroutants**. `refreshedAt`
doit être **visible** et l'écart expliqué.

⚠️ **F-INS-03 (firstRun / matview vide)** : si aucun refresh n'a eu lieu, toutes les vues sont
vides. L'UI doit afficher un **état dédié** (« lancez un premier refresh ») et pas un EmptyState
ambigu confondu avec « pas de trafic ».

⚠️ **F-INS-04 (revenu funnel en cents)** : `FunnelResponse.totalRevenueCents` — vérifier la **même
ambiguïté d'unité** que CTA (AF-02) selon la façon dont la matview agrège `value`.

⚠️ **F-INS-05 (export PNG)** : capture DOM (html-to-image/canvas) — fragile (polices, RTL, dark
mode, taille). À tester sur les 3 locales et tailles d'écran.

⚠️ **F-INS-06 (refresh manuel concurrent)** : si deux admins cliquent « Rafraîchir » en même temps,
le lock doit faire échouer/skip le second proprement (pas d'erreur 500 ni de double run).

## 3. Points à vérifier / tester

| PoV | À garantir |
|---|---|
| **Fonctionnel UI** | Changer `window/env/device/locale/trafficSource` refetch et met à jour **toutes** les vues. Onglets internes (overview/pages/components/sections/funnel) commutent. Drill-down ouvre le drawer avec les bonnes données. |
| **Refresh** | Bouton « Rafraîchir » : passe `running` → `success` ; lock empêche le double run (F-INS-06) ; `refreshedAt` mis à jour ; `firstRun` géré (F-INS-03). |
| **Settings** | Toggle `enabled` + `intervalMinutes` (valeurs autorisées seulement) ; persistance ; effet sur le cron. |
| **Exports** | CSV par view = colonnes attendues, échappement, séparateur, BOM/encodage ; PNG généré non vide, lisible (F-INS-05). |
| **Précision** | KPIs cohérents (avgEventsPerSession = totalEvents/uniqueSessions ; share ∈ [0,1] et Σ ≈ 1 ; bounceRate ∈ [0,1]) ; variations vs période précédente justes ; heatmap 7×24. |
| **Cohérence inter-onglets** | Écart Insights (matview) vs Funnel/Checkout (live) expliqué via `refreshedAt`. Unité revenu funnel (F-INS-04). |
| **Edge cases** | matview vide (firstRun) ; refresh failed (affiche erreur) ; window=custom bornes invalides → message ; dead_components vide. |
| **a11y** | Heatmap accessible (table/aria), drawer focus-trap + Échap, boutons export avec libellés, charts avec description. |

## 4. Findings (extrait)

| ID | Sév. | Résumé |
|---|---|---|
| AF-05 | P1 | Double barre de filtres (layout + InsightsView), modèles divergents |
| F-INS-02 | P2 | Fraîcheur matview vs live non explicitée |
| F-INS-03 | P2 | État firstRun/matview vide à distinguer de « pas de trafic » |
| F-INS-04 | P2 | Unité revenu funnel à vérifier (cents vs MAD) |
| F-INS-06 | P2 | Refresh manuel concurrent (lock à tester) |
