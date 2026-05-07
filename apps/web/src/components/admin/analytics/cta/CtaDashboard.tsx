/**
 * CtaDashboard — orchestrateur client de l'onglet CTA.
 * cf. docs/analytics/05-onglets-specs.md §4
 *
 * Reçoit les données pré-chargées par le RSC et refetch quand les filtres
 * URL changent.
 */
'use client';

import { useEffect, useState } from 'react';

import type { AnalyticsFilters } from '@/lib/analytics/filters';
import { filtersToSearchParams } from '@/lib/analytics/filters';
import type { CtaData } from '@/lib/analytics/queries/cta';

import { CtaKpiGrid } from './CtaKpiGrid';
import { CtaTable } from './CtaTable';
import { CtaTopMessages } from './CtaTopMessages';
import { CtaTopPages } from './CtaTopPages';

interface CtaDashboardProps {
  initialFilters: AnalyticsFilters;
  initialData: CtaData;
  /** Devise pour les montants (default EUR). */
  currency?: string;
}

export function CtaDashboard({
  initialFilters,
  initialData,
  currency = 'EUR',
}: CtaDashboardProps) {
  const [filters] = useState<AnalyticsFilters>(initialFilters);
  const [data, setData] = useState<CtaData>(initialData);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = filtersToSearchParams(filters).toString();
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
  }, [filters]);

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
