# 03 — Backend

> *Services agrégation, routes API admin, cache, audit*

---

## 1. Carte des routes

| Méthode    | Route                                                | Rôle                                                  |
| ---------- | ---------------------------------------------------- | ----------------------------------------------------- |
| GET        | `/api/admin/analytics/insights/overview`              | KPIs + time-series + heatmap                          |
| GET        | `/api/admin/analytics/insights/events`                | Top events + distribution                             |
| GET        | `/api/admin/analytics/insights/pages`                 | Top pages + drill-down                                |
| GET        | `/api/admin/analytics/insights/pages/[route]`         | Détail d'une page (events liés)                       |
| GET        | `/api/admin/analytics/insights/components`            | Top composants + composants morts                     |
| GET        | `/api/admin/analytics/insights/components/[id]`       | Détail d'un composant (events qu'il déclenche)        |
| GET        | `/api/admin/analytics/insights/sections`              | Sections + dwell time                                  |
| GET        | `/api/admin/analytics/insights/funnel`                | Tunnel ecommerce + drop-offs                          |
| GET        | `/api/admin/analytics/insights/refresh`               | Statut du dernier run                                  |
| POST       | `/api/admin/analytics/insights/refresh`               | Refresh manuel (admin) ou cron (Bearer)               |
| GET / PATCH | `/api/admin/analytics/insights/settings`             | Toggle ON/OFF + fréquence                              |
| GET        | `/api/admin/analytics/insights/export`                | CSV par vue                                            |

## 2. Contrats Zod (extraits)

```ts
// lib/analytics/insights/contracts.ts
import { z } from 'zod';

export const WINDOW_KEYS = ['today', 'yesterday', '7d', '30d', '90d', 'custom', 'all'] as const;

export const insightsFiltersSchema = z.object({
  window: z.enum(WINDOW_KEYS).default('7d'),
  customFrom: z.string().date().optional(),
  customTo: z.string().date().optional(),
  env: z.enum(['production', 'stage', 'preview', 'dev', 'all']).default('all'),
  device: z.enum(['mobile', 'desktop', 'tablet', 'unknown', 'all']).default('all'),
  locale: z.string().max(20).default('all'),
  trafficSource: z.string().max(80).default('all'),
});

export type InsightsFilters = z.infer<typeof insightsFiltersSchema>;

export const overviewResponseSchema = z.object({
  kpis: z.object({
    totalEvents: z.number().int().nonnegative(),
    uniqueSessions: z.number().int().nonnegative(),
    pageViews: z.number().int().nonnegative(),
    conversions: z.number().int().nonnegative(),
    avgEventsPerSession: z.number().nonnegative(),
    bounceRate: z.number().min(0).max(1),
  }),
  variations: z.record(z.string(), z.number()),
  timeseries: z.array(
    z.object({
      date: z.string().date(),
      events: z.number().int(),
      sessions: z.number().int(),
      conversions: z.number().int(),
    }),
  ),
  heatmap: z.array(
    z.object({
      hour: z.number().int().min(0).max(23),
      dayOfWeek: z.number().int().min(0).max(6),
      count: z.number().int().nonnegative(),
    }),
  ),
  refreshedAt: z.string().datetime(),
});
```

## 3. Services

### 3.1 `lib/analytics/insights/overview.ts`

```ts
export const overviewService = {
  async get(filters: InsightsFilters): Promise<OverviewResponse> {
    const { from, to } = resolveWindow(filters);
    const events = await listEventsBetween(from, to, filters);
    const sessions = sumDistinctSessions(events);
    const conversions = sumConversions(events);
    const variations = await computeVariations(filters); // période précédente
    const heatmap = await heatmapBetween(from, to, filters);
    return {
      kpis: { totalEvents: sum(events.map(e => e.count)), uniqueSessions: sessions, /* ... */ },
      variations,
      timeseries: rollupByDay(events),
      heatmap,
      refreshedAt: await lastRefreshAt(),
    };
  },
};
```

### 3.2 `lib/analytics/insights/pages.ts`

```ts
export const pagesService = {
  async top(filters: InsightsFilters, limit = 30): Promise<PagesTopResponse> {
    const rows = await db
      .select({
        pageRoute: insightsPageDaily.pageRoute,
        pageViews: sum(insightsPageDaily.pageViews).as('pv'),
        sessions: sum(insightsPageDaily.uniqueSessions).as('s'),
        conversions: sum(insightsPageDaily.conversions).as('c'),
        scroll75: sum(insightsPageDaily.scroll75Count).as('s75'),
      })
      .from(insightsPageDaily)
      .where(and(
        gte(insightsPageDaily.date, from),
        lte(insightsPageDaily.date, to),
      ))
      .groupBy(insightsPageDaily.pageRoute)
      .orderBy(desc('pv'))
      .limit(limit);
    return { pages: rows };
  },

  async detail(pageRoute: string, filters: InsightsFilters): Promise<PageDetailResponse> {
    // Drill-down : top events qui se sont produits sur cette page
    const events = await db
      .select({...})
      .from(insightsComponentDaily)
      .where(eq(insightsComponentDaily.pageRoute, pageRoute))
      .groupBy(insightsComponentDaily.eventName)
      .orderBy(desc('count'))
      .limit(20);
    return { route: pageRoute, events };
  },
};
```

### 3.3 `lib/analytics/insights/components.ts`

```ts
export const componentsService = {
  async top(filters: InsightsFilters, limit = 50): Promise<ComponentsTopResponse> { /* … */ },
  async detail(componentId: string, filters): Promise<ComponentDetailResponse> { /* … */ },
  async dead(filters: InsightsFilters): Promise<DeadComponentsResponse> {
    // Composants qui existent dans tracking_components mais n'apparaissent jamais
    // dans insights_component_daily sur la fenêtre choisie.
    const seen = await db.selectDistinct({ id: insightsComponentDaily.componentId })...
    const all = await db.select(...).from(trackingComponents);
    return { components: all.filter(c => !seen.has(c.id)) };
  },
};
```

### 3.4 `lib/analytics/insights/sections.ts`

```ts
export const sectionsService = {
  async byDwell(filters: InsightsFilters, limit = 30): Promise<SectionsResponse> {
    // Top sections par durée moyenne d'attention
    return await db.select(...).from(insightsSectionDaily).orderBy(desc('avg_dwell_seconds'))...
  },
};
```

### 3.5 `lib/analytics/insights/funnel.ts`

```ts
export const funnelService = {
  async daily(filters: InsightsFilters): Promise<FunnelResponse> {
    const rows = await db.select(...).from(insightsFunnelDaily)...;
    // Calcul des drop-offs par étape
    const stages = computeStages(rows);
    return { stages, dropoffs: computeDropoffs(stages), totalRevenue: sum(...) };
  },
};
```

### 3.6 `lib/analytics/insights/refresh.ts`

Orchestration. Cf. [07-refresh-orchestration.md](07-refresh-orchestration.md)
pour le détail.

```ts
export const refreshService = {
  async run(opts: { trigger: 'cron' | 'manual'; actorId: string | null }): Promise<RefreshRunResult> {
    const lock = await acquireLock();
    if (!lock) throw new HttpError('rate_limited', 'Refresh déjà en cours');
    const runId = createId('irf');
    try {
      const durations: Record<string, number> = {};
      const counts: Record<string, number> = {};
      for (const step of [
        ['event', refreshEventDaily],
        ['page', refreshPageDaily],
        ['component', refreshComponentDaily],
        ['section', refreshSectionDaily],
        ['funnel', refreshFunnelDaily],
      ] as const) {
        const t0 = performance.now();
        const c = await step[1]();
        durations[step[0]] = Math.round(performance.now() - t0);
        counts[step[0]] = c;
      }
      await markSuccess(runId, durations, counts);
      return { ok: true, runId, durations, counts };
    } catch (err) {
      await markFailed(runId, err);
      throw err;
    } finally {
      await releaseLock();
    }
  },

  async status(): Promise<RefreshStatusResponse> {
    const last = await db.select(...).from(insightsRefreshRun).orderBy(desc(...)).limit(1);
    return { last: last[0], lockHeld: await isLockHeld() };
  },
};
```

## 4. Cache HTTP

```ts
// app/api/admin/analytics/insights/overview/route.ts
return NextResponse.json(payload, {
  headers: {
    'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
    'X-Insights-Refreshed-At': payload.refreshedAt,
  },
});
```

- Cache 60 s (suffit avec refresh 15 min)
- `stale-while-revalidate` permet de servir l'ancien pendant le
  refetch
- Privé (auth admin), pas de CDN cache

## 5. Audit log

Toutes les actions admin loguées :

| Action                   | Entrée audit                                                 |
| ------------------------ | ------------------------------------------------------------ |
| Refresh manuel           | `analytics.insights.refresh` (actor, durations, counts)      |
| Toggle settings          | `analytics.insights.toggle` (actor, oldState, newState)      |
| Export CSV               | `analytics.insights.export` (actor, view, window, rows)      |
| Settings update           | `analytics.insights.settings_update`                          |

## 6. Permissions

| Rôle existant ou à ajouter | Accès                                                  |
| -------------------------- | ------------------------------------------------------ |
| `admin`                    | Tout                                                    |
| `analytics-viewer`         | GET seulement, pas de refresh manuel ni settings        |
| `support-agent`            | GET overview + pages seulement (pas drill-down)         |

## 7. Codes d'erreur

```ts
type InsightsErrorCode =
  | 'unauthorized'
  | 'invalid_filter'
  | 'window_too_large'      // > 90 j → 422
  | 'refresh_in_progress'   // 409
  | 'no_data'                // 404
  | 'export_too_large'       // > 100 000 lignes → 422
  | 'internal_error';
```

## 8. Cas particuliers

### 8.1 Window trop grande

> Si `window=all` et qu'il y a > 1 an de données, on cap à 365 j et
> on warn dans la réponse.

### 8.2 Première utilisation (table vide)

> Renvoyer un payload structuré avec arrays vides + flag `firstRun: true`.
> Le frontend affiche un empty state éditorial.

### 8.3 Refresh failed

> La route GET continue de servir les anciennes données (jusqu'à
> ce que le prochain refresh réussisse). L'indicateur "Dernière
> mise à jour" affiche un warning + erreur du dernier run.

## 9. Lecture suivante

- [04 — Frontend](04-frontend.md) pour la consommation côté UI.
- [07 — Refresh & orchestration](07-refresh-orchestration.md) pour
  les détails d'orchestration.
- [09 — Tests](09-tests.md) pour la stratégie de test.
