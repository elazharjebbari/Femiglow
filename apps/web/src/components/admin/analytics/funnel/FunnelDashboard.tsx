/**
 * FunnelDashboard — orchestrateur client de l'onglet Funnel.
 * cf. docs/analytics/05-onglets-specs.md §3
 *
 * Reçoit l'overview + sankey + by-page pré-chargés par le RSC, ne refetch que
 * si l'admin change les filtres (period/device/traffic) — relais via URL et
 * `useEffect` qui tape `/api/admin/analytics/funnel{,/sankey}?...`.
 */
'use client';

import { useEffect, useState } from 'react';

import type {
  FunnelByPageData,
  FunnelOverviewData,
  FunnelSankeyData,
} from '@/lib/analytics/queries/funnel';
import type { AnalyticsFilters } from '@/lib/analytics/filters';
import { filtersToSearchParams } from '@/lib/analytics/filters';

import { FunnelByPageSankey } from './FunnelByPageSankey';
import { FunnelDataTable } from './FunnelDataTable';
import { FunnelDropOff } from './FunnelDropOff';
import { FunnelGlobal } from './FunnelGlobal';

interface FunnelDashboardProps {
  initialFilters: AnalyticsFilters;
  initialOverview: FunnelOverviewData;
  initialSankey: FunnelSankeyData;
  initialByPage: FunnelByPageData;
}

interface State {
  overview: FunnelOverviewData;
  sankey: FunnelSankeyData;
  byPage: FunnelByPageData;
  loading: boolean;
  error: string | null;
}

export function FunnelDashboard({
  initialFilters,
  initialOverview,
  initialSankey,
  initialByPage,
}: FunnelDashboardProps) {
  const [filters] = useState<AnalyticsFilters>(initialFilters);
  const [state, setState] = useState<State>({
    overview: initialOverview,
    sankey: initialSankey,
    byPage: initialByPage,
    loading: false,
    error: null,
  });

  // Quand l'admin change les filtres via FilterBar (qui réécrit l'URL), on
  // refetch les 3 endpoints en parallèle.
  useEffect(() => {
    let cancelled = false;
    const params = filtersToSearchParams(filters).toString();
    const q = params ? `?${params}` : '';
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.all([
      fetch(`/api/admin/analytics/funnel${q}`, { cache: 'no-store' }).then(
        (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<FunnelOverviewData>;
        },
      ),
      fetch(`/api/admin/analytics/funnel/sankey${q}`, { cache: 'no-store' }).then(
        (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<FunnelSankeyData>;
        },
      ),
      fetch(
        `/api/admin/analytics/funnel${q}${q ? '&' : '?'}view=table`,
        { cache: 'no-store' },
      ).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<FunnelByPageData>;
      }),
    ])
      .then(([overview, sankey, byPage]) => {
        if (cancelled) return;
        setState({ overview, sankey, byPage, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'fetch_failed',
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div className="flex flex-col gap-6" data-testid="funnel-dashboard">
      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelGlobal steps={state.overview.steps} loading={state.loading} />
        <FunnelDropOff steps={state.overview.steps} loading={state.loading} />
      </div>

      <FunnelByPageSankey
        links={state.sankey.links}
        truncated={state.sankey.truncated}
        loading={state.loading}
      />

      <FunnelDataTable rows={state.byPage.rows} loading={state.loading} />
    </div>
  );
}
