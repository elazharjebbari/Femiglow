# 09 — Stratégie de tests

> *Vitest unit, MSW intégration, Playwright E2E, ~ 200 scénarios*

---

## 1. Pyramide

```
                    ┌──────────────────────────┐
                    │  E2E Playwright (15)      │   parcours admin clés
                    └──────────────────────────┘
              ┌──────────────────────────────────────┐
              │  Integration MSW + Vitest (60)        │
              │  Routes API + composants client       │
              └──────────────────────────────────────┘
       ┌────────────────────────────────────────────────────┐
       │  Unit Vitest (130)                                  │
       │  Services, helpers, hooks, charts, refresh, audit   │
       └────────────────────────────────────────────────────┘
```

**Total cible : ~ 205 cas Vitest + 15 specs Playwright**.

## 2. Unit (Vitest)

### 2.1 `lib/analytics/insights/`

| Fichier de test                 | Cas | Couvre                                                                |
| ------------------------------- | --- | --------------------------------------------------------------------- |
| `filters.test.ts`               | 15  | resolveWindow (8 cas) + parsing + validation Zod (custom range > 365j) |
| `overview.test.ts`              | 12  | KPIs, variations vs période précédente, edge cases (vide, 1 jour)      |
| `events.test.ts`                | 10  | Top events, distribution, percentiles                                  |
| `pages.test.ts`                 | 10  | Top pages, drill-down, bounce rate                                     |
| `components.test.ts`            | 12  | Top, dead components, drill-down                                       |
| `sections.test.ts`              | 8   | Dwell time, top par durée                                              |
| `funnel.test.ts`                | 10  | Étapes, drop-offs, période vide                                        |
| `refresh.test.ts`               | 18  | Lock pessimiste, idempotence, toggle OFF, errors                       |
| `audit.test.ts`                 | 5   | Audit log entries cohérentes                                           |

### 2.2 `hooks/insights/`

| Fichier de test                  | Cas | Couvre                                                              |
| -------------------------------- | --- | ------------------------------------------------------------------- |
| `use-insights-filters.test.tsx`  | 12  | Parse URL → filtres, set → URL update, reset, custom range, debounce |
| `use-insights-overview.test.tsx` | 6   | SWR fetch, dedup, refresh, error                                    |

### 2.3 `components/admin/analytics/insights/`

| Composant                       | Cas | Couvre                                                              |
| ------------------------------- | --- | ------------------------------------------------------------------- |
| `KpiCard.test.tsx`              | 6   | Render, count-up, variation positive/negative/zero, reduced-motion   |
| `EventsTimeSeries.test.tsx`     | 6   | Render, scales, tooltips, vide, 1 point, 60 points                  |
| `ActivityHeatmap.test.tsx`      | 5   | Render, opacités, tooltip natif, vide                              |
| `TopEventsTable.test.tsx`       | 5   | Tri, pagination, click row, vide                                    |
| `PagesTopTable.test.tsx`        | 5   | idem                                                                |
| `PagesTreemap.test.tsx`         | 4   | Layout proportionnel, tooltip                                        |
| `ComponentsTopTable.test.tsx`   | 5   | idem                                                                |
| `DeadComponentsList.test.tsx`   | 3   | Render, vide, beaucoup                                               |
| `SectionsBarChart.test.tsx`     | 4   | Échelle, tooltip                                                     |
| `SectionsDwellTable.test.tsx`   | 3   | Format duration                                                      |
| `FunnelSankey.test.tsx`         | 5   | 5 étapes, drop-offs visibles, vide, 1 étape                          |
| `FunnelDropoffTable.test.tsx`   | 3   | Calcul drop-off + conversion %                                        |
| `InsightsFilters.test.tsx`      | 5   | Selects, reset, custom range                                         |
| `InsightsRefreshIndicator.test.tsx` | 6 | États : success / running / failed / disabled / firstRun + bouton    |
| `EmptyState.test.tsx`           | 2   | Render + bouton "étendre"                                             |
| `__a11y__.test.tsx`             | 12  | jest-axe sur tous les composants critiques                            |

## 3. Intégration MSW (Vitest)

### 3.1 Routes API

| Fichier                                              | Cas | Couvre                                                  |
| ---------------------------------------------------- | --- | ------------------------------------------------------- |
| `admin-analytics-insights-overview.test.ts`          | 8   | 401, vide, 1j, 30j, custom, env filter, audit appelé   |
| `admin-analytics-insights-pages.test.ts`             | 7   | top, drill-down, vide, 401                              |
| `admin-analytics-insights-components.test.ts`        | 8   | top, dead, drill-down                                   |
| `admin-analytics-insights-sections.test.ts`          | 5   | top, drill-down                                         |
| `admin-analytics-insights-funnel.test.ts`            | 6   | étapes, drop-offs, vide                                 |
| `admin-analytics-insights-refresh.test.ts`           | 12  | manual + cron, lock, toggle OFF, échec, idempotent      |
| `admin-analytics-insights-export.test.ts`            | 8   | CSV BOM UTF-8, > 100k refus, audit                      |
| `admin-analytics-insights-settings.test.ts`          | 6   | GET, PATCH toggle, intervalMinutes validation           |

### 3.2 MSW pattern

Pattern réutilisé du module GTM : mock `getAdminSession`, mock
`auditTrackingChange`, appels directs des handlers.

## 4. Tests E2E Playwright

15 specs dans `apps/web/e2e/admin-analytics-insights.spec.ts` :

| Spec                                                         | Couvre                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `page protégée par auth`                                      | redirect login si pas de session                                    |
| `5 sous-onglets visibles`                                     | Overview · Pages · Composants · Sections · Funnel                  |
| `filtre window — 7d → 30d update les KPIs`                   | URL mise à jour + fetch + chiffres changent                         |
| `filtre custom range — From > To rejette`                    | message d'erreur, pas de crash                                      |
| `RefreshIndicator — bouton manual lance un run`              | dernière MAJ "à l'instant"                                          |
| `Toggle ON/OFF — désactive auto + indique au user`            | indicateur "désactivé"                                              |
| `Click sur une ligne PagesTopTable → drawer drill-down`      | drawer visible avec events de la page                                |
| `Click sur une ligne ComponentsTopTable → drawer`            | idem                                                                |
| `DeadComponentsList — vide + non-vide`                       | empty state OK, liste OK                                            |
| `Funnel — affiche 5 étapes + drop-offs`                       | Sankey + table                                                      |
| `Heatmap — 24×7 cells visibles, tooltips natifs`             | accessible clavier                                                   |
| `Export CSV — déclenche download avec bon filename`          | Content-Disposition correct, BOM UTF-8                               |
| `Window=all — borne à 365j sans crash`                       | warning visible, pas d'erreur                                        |
| `firstRun state visible si data vide`                        | "Premier calcul en cours…"                                           |
| `lighthouse perf ≥ 90` (CI)                                   | Lighthouse audit                                                     |

## 5. Property-based testing

Pour les fonctions pures critiques :

| Fonction                    | Invariant                                                          |
| --------------------------- | ------------------------------------------------------------------ |
| `resolveWindow`             | `to >= from` toujours, durée cohérente                              |
| `computeDropoff`            | `dropoff <= 0`, `conversion ∈ [0, 1]`                                |
| `linearScale`               | `scale(d0) = r0`, `scale(d1) = r1`, monotone                        |
| `formatDuration`            | round-trip avec parser                                              |
| `aggregateEvents`           | sum(by_day) === total ; commute avec filter                         |

## 6. A11y avec jest-axe

Configuration commune :

```ts
const AXE_OPTIONS = {
  rules: {
    'definition-list': { enabled: false },     // déjà documenté GTM
    'landmark-one-main': { enabled: false },
    region: { enabled: false },
    'page-has-heading-one': { enabled: false },
  },
};
```

Tous les composants critiques passent `axe(...).violations === []`.

## 7. Performance tests

| Test                                         | Cible           |
| -------------------------------------------- | --------------- |
| `lib/analytics/insights/overview` 10 000 events | < 50 ms          |
| `refreshEventDaily` simulation 100k rows      | < 8 s            |
| `EventsTimeSeries` render 60 points           | < 30 ms          |
| `ActivityHeatmap` render 168 cells           | < 20 ms          |

## 8. Setup de tests

### 8.1 Fixtures partagées

`src/test/fixtures/insights-fixtures.ts` :

```ts
export const FIXTURE_OVERVIEW = {
  kpis: { totalEvents: 12437, uniqueSessions: 3210, /* ... */ },
  variations: { totalEvents: 0.14 },
  timeseries: [
    { date: '2026-05-01', events: 1800, sessions: 480, conversions: 6 },
    /* ... 7 points */
  ],
  heatmap: [/* 168 cells */],
  refreshedAt: '2026-05-07T12:00:00Z',
};
```

### 8.2 Mock fetch

Pattern réutilisé GTM : `vi.stubGlobal('fetch', vi.fn())`.

### 8.3 Reset DB

Pour les tests intégration backend, reset des tables `insights_*`
entre tests via `_resetForTests` (pattern config-store).

## 9. CI

```yaml
- name: Vitest insights
  run: pnpm --filter @femiglow/web test src/lib/analytics/insights src/components/admin/analytics src/test/integration/admin-analytics-insights

- name: Playwright insights
  run: pnpm --filter @femiglow/web test:e2e --grep "insights"
```

## 10. Lecture suivante

- [10 — Plan d'action](10-plan-action.md) pour la séquence d'exécution.
- [annexes/scenarios-tests.md](annexes/scenarios-tests.md) pour
  la matrice complète.
