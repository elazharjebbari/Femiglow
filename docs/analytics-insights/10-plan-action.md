# 10 — Plan d'action

> *Tickets atomiques `INS-001` → `INS-150`, 7 phases*

---

## 1. Vue d'ensemble

7 phases séquentielles, ~ 150 tâches atomiques, **~ 14 jours**
pour 1 dev fullstack senior + 0.5 designer.

```
P0 — Fondations data         S1   (15 tâches)   2 j
P1 — Refresh & orchestration  S1   (18 tâches)   2 j
P2 — Backend services + API   S2   (32 tâches)   3 j
P3 — Frontend composants      S3   (38 tâches)   3 j
P4 — Visualisations           S3-S4 (20 tâches)  2 j
P5 — Filtres & exports        S4   (14 tâches)   1 j
P6 — Tests + runbook + a11y    S5   (13 tâches)   1 j
                                                  ──
                                                  14 j
```

## 2. Phase 0 — Fondations data (S1, 2 j)

| ID         | Tâche                                                                | Estim |
| ---------- | -------------------------------------------------------------------- | ----- |
| INS-001    | Schéma Drizzle `insights_event_daily` + migration                     | 0.25 j |
| INS-002    | Schéma Drizzle `insights_page_daily` + migration                      | 0.25 j |
| INS-003    | Schéma Drizzle `insights_component_daily` + migration                 | 0.25 j |
| INS-004    | Schéma Drizzle `insights_section_daily` + migration                   | 0.25 j |
| INS-005    | Schéma Drizzle `insights_funnel_daily` + migration                    | 0.25 j |
| INS-006    | Schéma Drizzle `insights_refresh_run` + migration                     | 0.25 j |
| INS-007    | Indexes (date, event, page, component, dwell)                          | 0.25 j |
| INS-008    | Repos Drizzle `lib/db/queries/insights/*.ts`                            | 0.5 j |
| INS-009    | Tests Drizzle queries (12 cas)                                          | 0.5 j |
| INS-010    | Settings keys `insights.refresh_enabled`, `insights.refresh_interval_minutes` | 0.1 j |
| INS-011    | Type `InsightsFilters` + Zod schema                                     | 0.1 j |
| INS-012    | Type `InsightsRunResult` + Zod schema                                   | 0.1 j |
| INS-013    | Helper `resolveWindow(filters)` + tests (15 cas)                        | 0.25 j |
| INS-014    | Helper `formatNumber/Percent/Duration/DateShort` + tests                 | 0.1 j |
| INS-015    | Doc data complète (mise à jour `docs/analytics-insights/02-data.md`)    | 0.1 j |

DoD : `pnpm db:push` produit toutes les tables ; `Filters` et
helpers testés.

## 3. Phase 1 — Refresh & orchestration (S1, 2 j)

| ID         | Tâche                                                                | Estim |
| ---------- | -------------------------------------------------------------------- | ----- |
| INS-016    | Service `refresh.acquireLock()` / `releaseLock()`                      | 0.25 j |
| INS-017    | Service `refresh.run()` orchestrateur                                  | 0.5 j |
| INS-018    | Service `refreshEventDaily()` (incrémental + ON CONFLICT)              | 0.25 j |
| INS-019    | Service `refreshPageDaily()`                                            | 0.25 j |
| INS-020    | Service `refreshComponentDaily()`                                       | 0.25 j |
| INS-021    | Service `refreshSectionDaily()` (avec dérivation dwell time)            | 0.5 j |
| INS-022    | Service `refreshFunnelDaily()`                                          | 0.25 j |
| INS-023    | Helper `markSuccess` / `markFailed` (insights_refresh_run)              | 0.1 j |
| INS-024    | Tests `refresh.run` happy path (4 cas)                                  | 0.25 j |
| INS-025    | Tests `refresh.run` lock pessimiste (3 cas)                              | 0.1 j |
| INS-026    | Tests `refresh.run` toggle OFF (2 cas)                                  | 0.1 j |
| INS-027    | Tests `refresh.run` erreur étape 3 (2 cas)                              | 0.1 j |
| INS-028    | Route `POST /api/admin/analytics/insights/refresh` (manual + cron)      | 0.25 j |
| INS-029    | Route `GET /api/admin/analytics/insights/refresh` (status)               | 0.1 j |
| INS-030    | Cron Vercel `*/15 * * * *`                                              | 0.1 j |
| INS-031    | Tests integration MSW (`refresh.test.ts` × 12 cas)                       | 0.5 j |
| INS-032    | Audit log entries `analytics.insights.refresh`                          | 0.1 j |
| INS-033    | Settings `GET / PATCH` + tests (toggle, intervalMinutes)                | 0.25 j |

DoD : un POST manuel termine en < 30 s sur 30 j ; lock fonctionnel ;
audit log présent.

## 4. Phase 2 — Backend services + API (S2, 3 j)

| ID         | Tâche                                                                | Estim |
| ---------- | -------------------------------------------------------------------- | ----- |
| INS-034    | Service `overviewService.get`                                         | 0.5 j |
| INS-035    | Tests `overview.test.ts` (12 cas)                                     | 0.5 j |
| INS-036    | Service `eventsService.top` + distribution                             | 0.25 j |
| INS-037    | Tests `events.test.ts` (10 cas)                                        | 0.25 j |
| INS-038    | Service `pagesService.top`                                             | 0.25 j |
| INS-039    | Service `pagesService.detail` (drill-down)                              | 0.25 j |
| INS-040    | Tests `pages.test.ts` (10 cas)                                          | 0.5 j |
| INS-041    | Service `componentsService.top`                                         | 0.25 j |
| INS-042    | Service `componentsService.detail` (drill-down)                          | 0.25 j |
| INS-043    | Service `componentsService.dead`                                         | 0.25 j |
| INS-044    | Tests `components.test.ts` (12 cas)                                     | 0.5 j |
| INS-045    | Service `sectionsService.top` (avec dwell time)                          | 0.5 j |
| INS-046    | Tests `sections.test.ts` (8 cas)                                         | 0.25 j |
| INS-047    | Service `funnelService.daily`                                            | 0.25 j |
| INS-048    | Helper `computeDropoffs`                                                  | 0.1 j |
| INS-049    | Tests `funnel.test.ts` (10 cas)                                          | 0.25 j |
| INS-050    | Routes API admin (8 routes — overview / events / pages / pages/[route] / components / components/[id] / sections / funnel) | 1 j   |
| INS-051    | Cache HTTP `private, max-age=60`                                         | 0.1 j |
| INS-052    | Tests integration MSW (8 fichiers × ~ 8 cas)                             | 1 j   |
| INS-053    | Service `exportService.csv` (BOM UTF-8, < 100k limit)                    | 0.5 j |
| INS-054    | Route `GET /api/admin/analytics/insights/export`                          | 0.25 j |
| INS-055    | Tests export (8 cas)                                                     | 0.25 j |
| INS-056    | Audit log pour exports                                                    | 0.1 j |
| INS-057    | Permissions (analytics-viewer / admin)                                    | 0.25 j |
| INS-058    | Doc backend (mise à jour `docs/analytics-insights/03-backend.md`)         | 0.1 j |
| INS-059    | Code review tickets P2                                                    | 0.25 j |
| INS-060    | Performance bench (5 routes × 100k rows)                                  | 0.25 j |
| INS-061    | Logs structurés sur les services                                          | 0.1 j |
| INS-062    | Window > 365j refus 422                                                  | 0.1 j |
| INS-063    | Custom range invalid → 422                                                | 0.1 j |
| INS-064    | First run flag dans response                                              | 0.1 j |
| INS-065    | Service `componentsService.dead` (mise à jour avec composants seed)        | 0.1 j |

DoD : 8 routes répondent < 250 ms p95 ; tests intégration verts ;
exports CSV ouvrent dans Excel.

## 5. Phase 3 — Frontend composants (S3, 3 j)

| ID         | Tâche                                                                | Estim |
| ---------- | -------------------------------------------------------------------- | ----- |
| INS-066    | Composant `<InsightsShell>`                                            | 0.25 j |
| INS-067    | Composant `<InsightsFilters>`                                           | 0.5 j |
| INS-068    | Composant `<InsightsRefreshIndicator>` (4 états)                        | 0.5 j |
| INS-069    | Composant `<InsightsTabs>` (réutilise pattern GTM)                       | 0.25 j |
| INS-070    | Composant `<KpiCard>` + animation count-up                              | 0.25 j |
| INS-071    | Composants `<EmptyState>`, `<LoadingPanel>`, `<ErrorPanel>`              | 0.25 j |
| INS-072    | Hook `useInsightsFilters` (URL ↔ state)                                  | 0.5 j |
| INS-073    | Tests `use-insights-filters.test.tsx` (12 cas)                            | 0.5 j |
| INS-074    | Hook `useInsightsOverview` (SWR)                                         | 0.25 j |
| INS-075    | Hook `useInsightsPages`, `useInsightsComponents`                         | 0.25 j |
| INS-076    | Hook `useInsightsSections`, `useInsightsFunnel`                          | 0.25 j |
| INS-077    | Hook `useInsightsRefresh`                                                 | 0.25 j |
| INS-078    | Tests hooks (6 cas)                                                       | 0.25 j |
| INS-079    | `<OverviewPanel>` (KPIs + timeseries + heatmap + topEvents)              | 0.5 j |
| INS-080    | `<PagesPanel>` (top + treemap + drill-down)                              | 0.5 j |
| INS-081    | `<PageDetailDrawer>` (drill-down)                                          | 0.25 j |
| INS-082    | `<ComponentsPanel>` (top + dead)                                          | 0.5 j |
| INS-083    | `<ComponentDetailDrawer>`                                                  | 0.25 j |
| INS-084    | `<SectionsPanel>` (bar + table)                                            | 0.5 j |
| INS-085    | `<FunnelPanel>` (sankey + dropoff table)                                   | 0.5 j |
| INS-086    | Tests RTL des 8 panels (~ 30 cas total)                                    | 1 j   |
| INS-087    | Page Next.js `/admin/analytics/insights/page.tsx`                          | 0.25 j |
| INS-088    | Layout responsive < 768 px                                                 | 0.25 j |
| INS-089    | Skip skeleton flash quand cache hit                                         | 0.1 j |
| INS-090    | Tests `__a11y__.test.tsx` jest-axe (12 cas)                                | 0.5 j |
| INS-091    | A11y — focus management entre tabs et drawer                                | 0.25 j |
| INS-092    | Stories Storybook (V2 nice-to-have)                                         | 0.25 j |
| INS-093    | Doc frontend (mise à jour `docs/analytics-insights/04-frontend.md`)         | 0.1 j |
| INS-094    | Code review tickets P3                                                       | 0.25 j |
| INS-095    | Bundle size check < 80 kB gzip                                              | 0.1 j |
| INS-096    | Mobile : KPIs 2 par ligne                                                    | 0.1 j |
| INS-097    | Tablet : KPIs 3 par ligne                                                    | 0.1 j |
| INS-098    | Desktop : KPIs 6 par ligne                                                    | 0.1 j |
| INS-099    | First-run notice                                                              | 0.1 j |
| INS-100    | Indicator "Refresh failed"                                                    | 0.1 j |
| INS-101    | Toggle ON/OFF visible dans l'indicateur                                       | 0.1 j |
| INS-102    | Reset filtres bouton                                                          | 0.1 j |
| INS-103    | Custom range — 2 inputs date                                                  | 0.1 j |

DoD : page entièrement navigable au clavier ; lighthouse ≥ 90.

## 6. Phase 4 — Visualisations (S3-S4, 2 j)

| ID         | Tâche                                                                | Estim |
| ---------- | -------------------------------------------------------------------- | ----- |
| INS-104    | `<EventsTimeSeries>` (3 séries SVG)                                    | 0.5 j |
| INS-105    | Tests `EventsTimeSeries.test.tsx` (6 cas)                                | 0.25 j |
| INS-106    | `<ActivityHeatmap>` (24×7 grid)                                          | 0.5 j |
| INS-107    | Tests heatmap (5 cas)                                                     | 0.25 j |
| INS-108    | `<TopEventsTable>` (triable)                                              | 0.25 j |
| INS-109    | `<PagesTopTable>`                                                          | 0.25 j |
| INS-110    | `<PagesTreemap>` (SVG layout)                                              | 0.5 j |
| INS-111    | `<ComponentsTopTable>`                                                    | 0.25 j |
| INS-112    | `<DeadComponentsList>`                                                     | 0.25 j |
| INS-113    | `<SectionsBarChart>` (barres horizontales)                                 | 0.25 j |
| INS-114    | `<SectionsDwellTable>`                                                     | 0.25 j |
| INS-115    | `<FunnelSankey>` (5 étapes SVG)                                            | 0.5 j |
| INS-116    | `<FunnelDropoffTable>`                                                     | 0.25 j |
| INS-117    | Helpers `chart-helpers.ts`                                                 | 0.25 j |
| INS-118    | Tests visualisations (~ 20 cas)                                             | 0.5 j |
| INS-119    | A11y des charts (`<title>`, `aria-label`, contrastes)                      | 0.25 j |
| INS-120    | Doc visualisations (mise à jour `06-visualisations.md`)                    | 0.1 j |
| INS-121    | Tooltips natifs `<title>` partout                                            | 0.1 j |
| INS-122    | Animation drawing 320 ms ease-out                                            | 0.25 j |
| INS-123    | Reduced-motion respect                                                       | 0.1 j |

DoD : 12 visualisations rendent sans erreur ; bundle < 80 kB.

## 7. Phase 5 — Filtres & exports (S4, 1 j)

| ID         | Tâche                                                                | Estim |
| ---------- | -------------------------------------------------------------------- | ----- |
| INS-124    | URL parsing complet (window, env, device, locale, trafficSource)       | 0.25 j |
| INS-125    | Custom range UI (2 date pickers natifs)                                 | 0.25 j |
| INS-126    | Reset bouton                                                              | 0.1 j |
| INS-127    | Debounce 300 ms                                                            | 0.1 j |
| INS-128    | Export CSV bouton dans chaque panel                                        | 0.25 j |
| INS-129    | Confirmation modale si > 50k lignes                                         | 0.1 j |
| INS-130    | BOM UTF-8 dans le CSV                                                      | 0.1 j |
| INS-131    | Filename auto-daté `insights-<view>-<date>.csv`                              | 0.1 j |
| INS-132    | Audit log exports                                                            | 0.1 j |
| INS-133    | Tests integration export CSV (8 cas)                                          | 0.25 j |
| INS-134    | Tests filtres URL (12 cas)                                                    | 0.25 j |
| INS-135    | Doc filtres / exports (mise à jour `08-filtres-exports.md`)                  | 0.1 j |
| INS-136    | E2E filtre persistance reload                                                  | 0.1 j |
| INS-137    | E2E export CSV download                                                        | 0.1 j |

DoD : filtres persistent au reload ; exports ouvrent dans Excel.

## 8. Phase 6 — Tests + runbook + a11y (S5, 1 j)

| ID         | Tâche                                                                | Estim |
| ---------- | -------------------------------------------------------------------- | ----- |
| INS-138    | Suite Vitest complète verte                                            | 0.25 j |
| INS-139    | Suite Playwright complète verte (15 specs)                              | 0.25 j |
| INS-140    | Lighthouse perf ≥ 90, a11y ≥ 95                                          | 0.1 j |
| INS-141    | Audit RGPD signé                                                          | 0.1 j |
| INS-142    | Runbook complet (mise à jour `11-runbook.md`)                              | 0.25 j |
| INS-143    | Mise à jour CHANGELOG global                                                | 0.1 j |
| INS-144    | Plan post-launch (KPIs à monitorer)                                          | 0.1 j |
| INS-145    | Onboarding doc pour acquisition                                              | 0.1 j |
| INS-146    | Code review final                                                              | 0.25 j |
| INS-147    | Bundle audit final                                                              | 0.1 j |
| INS-148    | Migration : créer les tables en preview Vercel                                  | 0.1 j |
| INS-149    | Premier refresh sur preview                                                     | 0.1 j |
| INS-150    | Validation utilisateur                                                            | 0.1 j |

DoD : tous tests verts, lighthouse OK, runbook validé, audit RGPD
signé.

## 9. Estimation totale

| Phase | Charge   |
| ----- | -------- |
| 0 — Fondations data        | 2 j   |
| 1 — Refresh & orchestration | 2 j   |
| 2 — Backend services + API | 3 j   |
| 3 — Frontend composants    | 3 j   |
| 4 — Visualisations         | 2 j   |
| 5 — Filtres & exports      | 1 j   |
| 6 — Tests + runbook        | 1 j   |
| **Total**                  | **14 jours** |

## 10. Profil de l'équipe

| Rôle                    | Charge         |
| ----------------------- | -------------- |
| Tech lead full stack    | 14 j × 100 %   |
| Designer (Figma + tokens) | 2 j × 50 %  |
| QA / Acquisition (validation utilisateur) | 1 j × 50 % |

## 11. Jalons

| Jalon                                | Date cible             |
| ------------------------------------ | ---------------------- |
| Données pré-agrégées en preview       | fin S1                  |
| Première vue Overview fonctionnelle   | fin S2                  |
| 5 onglets navigables                  | fin S3                  |
| Tests verts + runbook                 | fin S5                  |
| Go / No-Go production                 | fin S5                  |

## 12. Risques projet

| Risque                                              | Mitigation                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| Refresh > 30 s qui pollue Vercel cron               | Optimiser indexes en P0 ; alerte si > 30 s                       |
| Bundle > 80 kB                                       | Lazy-load la page admin via `next/dynamic`                        |
| Lighthouse < 90 sur charts                          | Memoization + virtualisation tables                                |
| Drift filtres URL ↔ UI                               | Source de vérité = URL, hook `useFilters` strict                   |
| Tables `insights_*` orphelines si app détruite      | Migration drop avec dépendances claires (cf. doc `02-data.md`)    |

## 13. Définition de Done globale

Le système est livrable lorsque :

1. Toutes les tâches `INS-001` → `INS-150` sont en `done`.
2. Les KPIs `00-cahier-des-charges.md §5` sont vérifiés sur preview.
3. L'audit RGPD interne est signé.
4. Le runbook est complet et testé.
5. Le coût marginal d'un refresh sur Neon Pro reste < 5 % CPU.
6. Aucune régression Lighthouse sur les pages publiques (le module
   est autonome dans `/admin/`).

## 14. Lecture suivante

- [11 — Runbook](11-runbook.md) pour les opérations courantes.
- [09 — Tests](09-tests.md) pour la stratégie de test.
- [00 — Cahier des charges](00-cahier-des-charges.md) §8 pour les
  critères d'acceptation.
