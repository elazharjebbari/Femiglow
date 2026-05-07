/**
 * CheckoutDashboard — orchestrateur client de l'onglet Checkout.
 * cf. docs/analytics/05-onglets-specs.md §5
 *
 * Reçoit les données pré-chargées par le RSC et refetch quand les filtres
 * URL changent.
 */
'use client';

import { useEffect, useState } from 'react';

import type { AnalyticsFilters } from '@/lib/analytics/filters';
import { filtersToSearchParams } from '@/lib/analytics/filters';
import type { CheckoutData } from '@/lib/analytics/queries/checkout';

import { CheckoutAbandonedFields } from './CheckoutAbandonedFields';
import { CheckoutFormErrors } from './CheckoutFormErrors';
import { CheckoutFunnelStepper } from './CheckoutFunnelStepper';
import { CheckoutKpiGrid } from './CheckoutKpiGrid';
import { CheckoutTimeToSubmit } from './CheckoutTimeToSubmit';

interface CheckoutDashboardProps {
  initialFilters: AnalyticsFilters;
  initialData: CheckoutData;
}

export function CheckoutDashboard({
  initialFilters,
  initialData,
}: CheckoutDashboardProps) {
  const [filters] = useState<AnalyticsFilters>(initialFilters);
  const [data, setData] = useState<CheckoutData>(initialData);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = filtersToSearchParams(filters).toString();
    const q = params ? `?${params}` : '';
    setLoading(true);
    setError(null);
    fetch(`/api/admin/analytics/checkout${q}`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<CheckoutData>;
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
    <div className="flex flex-col gap-6" data-testid="checkout-dashboard">
      <CheckoutKpiGrid totals={data.totals} loading={loading} />
      <div className="grid gap-6 lg:grid-cols-2">
        <CheckoutFunnelStepper steps={data.steps} loading={loading} />
        <CheckoutTimeToSubmit data={data.timeToSubmit} loading={loading} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CheckoutFormErrors rows={data.topErrors} loading={loading} />
        <CheckoutAbandonedFields rows={data.topAbandonedFields} loading={loading} />
      </div>
    </div>
  );
}
