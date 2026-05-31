# 04 — Frontend

> *Composants, hooks, store, fetchers, pagination*

---

## 1. Arborescence

```
src/components/admin/analytics/insights/
├── InsightsShell.tsx                 // page racine + tabs + filtres
├── InsightsFilters.tsx                // panneau de filtres global
├── InsightsRefreshIndicator.tsx       // dernière MAJ + bouton manuel + toggle
├── overview/
│   ├── OverviewPanel.tsx
│   ├── KpiCards.tsx                   // 6 KPIs avec variation
│   ├── EventsTimeSeries.tsx           // line chart SVG
│   └── ActivityHeatmap.tsx            // heatmap 24×7
├── pages/
│   ├── PagesPanel.tsx
│   ├── PagesTopTable.tsx              // top 30
│   ├── PagesTreemap.tsx               // treemap pages × events
│   └── PageDetailDrawer.tsx           // drill-down
├── components/
│   ├── ComponentsPanel.tsx
│   ├── ComponentsTopTable.tsx         // top 50
│   ├── DeadComponentsList.tsx         // composants morts
│   └── ComponentDetailDrawer.tsx
├── sections/
│   ├── SectionsPanel.tsx
│   ├── SectionsDwellTable.tsx         // top par durée
│   └── SectionsBarChart.tsx           // barres horizontales
├── funnel/
│   ├── FunnelPanel.tsx
│   ├── FunnelSankey.tsx               // SVG sankey simple
│   └── FunnelDropoffTable.tsx
└── primitives/
    ├── ChartTooltip.tsx
    ├── ChartLegend.tsx
    ├── EmptyState.tsx
    ├── LoadingPanel.tsx
    └── ErrorPanel.tsx

src/hooks/insights/
├── use-insights-filters.ts            // filtres ↔ URL
├── use-insights-overview.ts            // SWR fetch overview
├── use-insights-pages.ts
├── use-insights-components.ts
├── use-insights-sections.ts
├── use-insights-funnel.ts
└── use-insights-refresh.ts

src/lib/analytics/insights/client/
└── chart-helpers.ts                    // ticks, formatters, scales
```

## 2. Composant racine `<InsightsShell>`

```tsx
export function InsightsShell({ initial, defaultTab = 'overview' }: Props) {
  const filters = useInsightsFilters();
  const refresh = useInsightsRefresh();

  return (
    <AdminShell adminEmail={...} active="analytics">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Analytics Insights</h1>
        <InsightsRefreshIndicator
          lastRun={refresh.lastRun}
          lockHeld={refresh.lockHeld}
          onTrigger={refresh.trigger}
        />
      </header>

      <InsightsFilters value={filters.value} onChange={filters.set} />

      <InsightsTabs
        defaultTab={defaultTab}
        panels={{
          overview: <OverviewPanel filters={filters.value} />,
          pages: <PagesPanel filters={filters.value} />,
          components: <ComponentsPanel filters={filters.value} />,
          sections: <SectionsPanel filters={filters.value} />,
          funnel: <FunnelPanel filters={filters.value} />,
        }}
      />
    </AdminShell>
  );
}
```

## 3. Hook `useInsightsFilters`

```ts
export function useInsightsFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const value = useMemo<InsightsFilters>(
    () => ({
      window: (params.get('window') ?? '7d') as Window,
      env: (params.get('env') ?? 'all') as any,
      device: (params.get('device') ?? 'all') as any,
      locale: params.get('locale') ?? 'all',
      trafficSource: params.get('trafficSource') ?? 'all',
      customFrom: params.get('customFrom') ?? undefined,
      customTo: params.get('customTo') ?? undefined,
    }),
    [params],
  );

  const set = useCallback(
    (patch: Partial<InsightsFilters>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === 'all') next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`?${next.toString()}`);
    },
    [params, router],
  );

  return { value, set };
}
```

## 4. Hook fetch — pattern unique

```ts
// hooks/insights/use-insights-overview.ts
import useSWR from 'swr';

export function useInsightsOverview(filters: InsightsFilters) {
  const url = '/api/admin/analytics/insights/overview?' + serializeFilters(filters);
  const { data, error, isLoading, mutate } = useSWR<OverviewResponse>(
    url,
    (u) => fetch(u, { credentials: 'include' }).then((r) => r.json()),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30_000,
    },
  );
  return { data, error, isLoading, refresh: mutate };
}
```

## 5. Composants de viz (SVG custom)

### 5.1 `<EventsTimeSeries>`

Un line chart simple, 1-3 séries, axe X = jours, axe Y = comptes.

```tsx
interface Props {
  data: Array<{ date: string; events: number; sessions: number; conversions: number }>;
  height?: number;
}

export function EventsTimeSeries({ data, height = 240 }: Props) {
  const width = 800; // viewBox, scale via CSS
  const margins = { top: 12, right: 16, bottom: 24, left: 40 };
  const xs = useMemo(() => data.map((d) => d.date), [data]);
  const yMax = useMemo(
    () => Math.max(...data.map((d) => Math.max(d.events, d.sessions, d.conversions))),
    [data],
  );
  const xScale = (i: number) =>
    margins.left + (i / Math.max(1, data.length - 1)) * (width - margins.left - margins.right);
  const yScale = (v: number) =>
    height - margins.bottom - (v / Math.max(1, yMax)) * (height - margins.top - margins.bottom);

  function path(values: number[]): string {
    return values
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`)
      .join(' ');
  }

  return (
    <svg
      role="img"
      aria-label="Évolution des événements par jour"
      viewBox={`0 0 ${width} ${height}`}
      className="block w-full"
    >
      {/* axes */}
      <line x1={margins.left} y1={height - margins.bottom} x2={width - margins.right} y2={height - margins.bottom} stroke="#D6D3CA" />
      {/* events line */}
      <path d={path(data.map((d) => d.events))} fill="none" stroke="#2C2A28" strokeWidth={1.5} />
      {/* sessions line */}
      <path d={path(data.map((d) => d.sessions))} fill="none" stroke="#A8C4A6" strokeWidth={1.5} />
      {/* conversions line */}
      <path d={path(data.map((d) => d.conversions))} fill="none" stroke="#C8A876" strokeWidth={1.5} />
    </svg>
  );
}
```

### 5.2 `<ActivityHeatmap>`

Grille 24 × 7 (heures × jours), opacité proportionnelle à `count`.

```tsx
export function ActivityHeatmap({ cells }: Props) {
  const max = Math.max(...cells.map((c) => c.count), 1);
  const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  return (
    <svg role="img" aria-label="Heatmap horaire" viewBox="0 0 480 200" className="block w-full">
      {[...Array(7)].map((_, dow) =>
        [...Array(24)].map((_, h) => {
          const c = cells.find((c) => c.dayOfWeek === dow && c.hour === h);
          const opacity = c ? c.count / max : 0;
          return (
            <rect
              key={`${dow}-${h}`}
              x={40 + h * 18}
              y={20 + dow * 24}
              width={16}
              height={22}
              fill="#A8C4A6"
              opacity={Math.max(0.05, opacity)}
            >
              <title>
                {dayLabels[dow]} {h}h : {c?.count ?? 0} events
              </title>
            </rect>
          );
        }),
      )}
    </svg>
  );
}
```

### 5.3 `<FunnelSankey>` simplifié

```tsx
export function FunnelSankey({ stages }: Props) {
  // 5 étapes, layout horizontal, largeur prop. au volume
  // SVG layout fixe, bandes traduisant les drop-offs
}
```

### 5.4 Autres composants

- `<KpiCard>` : 1 KPI, valeur + variation (sauge / pétale)
- `<TopTable>` : tableau triable et exportable, pagination 50
- `<Treemap>` : SVG par rectangles imbriqués
- `<BarChartHorizontal>` : pour sections + composants
- `<ChartTooltip>` : custom tooltip flottant (inline `<title>` en V1)

## 6. États

| État          | Composant           | Comportement                                         |
| ------------- | ------------------- | ---------------------------------------------------- |
| `idle`        | `<EmptyState>`       | "Aucune donnée pour cette fenêtre. Étend la période." |
| `loading`     | `<LoadingPanel>`     | Skeleton shimmer (cf. doc 15 design system GTM)      |
| `error`       | `<ErrorPanel>`       | Bannière red + bouton "Réessayer"                     |
| `success`     | composant viz        | Render normal                                         |
| `firstRun`    | `<FirstRunNotice>`   | "Le premier refresh est en cours, reviens dans qq min" |

## 7. Performance

- SWR `dedupingInterval: 30_000` : pas de fetch redondant
- Charts SVG mémoïsés via `useMemo` sur `data`
- Tableaux virtualisés (au-delà de 50 lignes) via `react-virtuoso` (déjà dispo via le chat ou ajout léger ~ 18 kB)
- Filtres URL : debounce 300 ms entre changement et refetch
- Bundle splitting : la page est dynamique, hydratée après idle

## 8. A11y

- Toutes les `<svg>` ont `role="img"` + `aria-label`
- `<title>` enfant pour le screen reader
- Tableaux : headers `scope="col"`, navigation clavier
- Filtres : labels associés, focus rings
- Heatmap : tooltip texte accessible (pas de hover-only)

## 9. Lecture suivante

- [05 — UI / UX & design](05-ui-ux-design.md) pour les choix visuels.
- [06 — Visualisations](06-visualisations.md) pour le détail de
  chaque chart.
- [09 — Tests](09-tests.md) pour les scénarios de test.
