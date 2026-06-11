/**
 * CtaDashboard — orchestrateur client de l'onglet CTA.
 * cf. docs/analytics/05-onglets-specs.md §4
 *
 * Source de vérité = l'URL (réactif via `useAnalyticsFilters`). Le RSC a
 * pré-chargé `initialData` pour `initialFilters` ; on ne refetch que lorsque
 * l'admin change réellement un filtre (period/device/traffic).
 * cf. docs/analytics-audit-qa-2026-05-30 — findings AF-01 (réactivité) +
 * F-PERF-03 (pas de double fetch au mount) + F-CTA-05 (devise MAD).
 */
'use client';

import { useEffect, useRef, useState } from 'react';

import type { AnalyticsFilters } from '@/lib/analytics/filters';
import { filtersToSearchParams } from '@/lib/analytics/filters';
import type { CtaData } from '@/lib/analytics/queries/cta';

import { useAnalyticsFilters } from '../hooks/useAnalyticsFilters';
import { CtaKpiGrid } from './CtaKpiGrid';
import { CtaTable } from './CtaTable';
import { CtaTopMessages } from './CtaTopMessages';
import { CtaTopPages } from './CtaTopPages';

interface CtaDashboardProps {
  initialFilters: AnalyticsFilters;
  initialData: CtaData;
  /** Devise pour les montants (MAD pour FemiGlow). */
  currency?: string;
}

export function CtaDashboard({
  initialFilters,
  initialData,
  currency = 'MAD',
}: CtaDashboardProps) {
  const { filters } = useAnalyticsFilters();
  const [data, setData] = useState<CtaData>(initialData);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const initialQs = filtersToSearchParams(initialFilters).toString();
  const isFirstRun = useRef(true);

  useEffect(() => {
    const params = filtersToSearchParams(filters).toString();
    // 1er rendu : si les filtres correspondent à ceux pré-chargés par le RSC,
    // on garde `initialData` (pas de refetch — F-PERF-03).
    if (isFirstRun.current) {
      isFirstRun.current = false;
      if (params === initialQs) return;
    }
    let cancelled = false;
    const q = params ? `?${params}` : '';
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/cta${q}`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<CtaData>;
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'fetch_failed');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, initialQs]);

  return (
    <div className="flex flex-col gap-6" data-testid="cta-dashboard">
      <CtaKpiGrid totals={data.totals} loading={loading} currency={currency} />
      <CtaTable rows={data.rows} loading={loading} currency={currency} />
      <div className="grid gap-6 lg:grid-cols-2">
        <CtaTopMessages rows={data.topMessages} loading={loading} />
        <CtaTopPages rows={data.topPages} loading={loading} />
      </div>
    </div>
  );
}
