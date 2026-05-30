/**
 * FunnelDashboard — orchestrateur client de l'onglet Funnel.
 * cf. docs/analytics/05-onglets-specs.md §3
 *
 * Source de vérité = l'URL (réactif via `useAnalyticsFilters`). Le RSC a
 * pré-chargé overview + sankey + by-page ; on ne refetch les 3 endpoints que
 * lorsque l'admin change un filtre (period/device/traffic).
 * cf. docs/analytics-audit-qa-2026-05-30 — AF-01 (réactivité) + F-PERF-03.
 */
'use client';

import { useEffect, useRef, useState } from 'react';

import type {
  FunnelByPageData,
  FunnelOverviewData,
  FunnelSankeyData,
} from '@/lib/analytics/queries/funnel';
import type { AnalyticsFilters } from '@/lib/analytics/filters';
import { filtersToSearchParams } from '@/lib/analytics/filters';

import { useAnalyticsFilters } from '../hooks/useAnalyticsFilters';
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
  const { filters } = useAnalyticsFilters();
  const [state, setState] = useState<State>({
    overview: initialOverview,
    sankey: initialSankey,
    byPage: initialByPage,
    loading: false,
    error: null,
  });
  const initialQs = filtersToSearchParams(initialFilters).toString();
  const isFirstRun = useRef(true);

  // Quand l'admin change les filtres via FilterBar (qui réécrit l'URL), on
  // refetch les 3 endpoints en parallèle.
  useEffect(() => {
    const params = filtersToSearchParams(filters).toString();
    if (isFirstRun.current) {
      isFirstRun.current = false;
      if (params === initialQs) return; // données déjà pré-chargées par le RSC
    }
    let cancelled = false;
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
  }, [filters, initialQs]);

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
