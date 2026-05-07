/**
 * CtaKpiGrid — 4 cards KPI globaux pour l'onglet CTA.
 * cf. docs/analytics/05-onglets-specs.md §4.2
 */
import { KpiCard } from '../primitives/KpiCard';
import type { CtaKpiTotals } from '@/lib/analytics/queries/cta';

interface CtaKpiGridProps {
  totals: CtaKpiTotals;
  loading?: boolean;
  /** Devise pour le revenu attribué (default EUR). */
  currency?: string;
}

export function CtaKpiGrid({ totals, loading, currency = 'EUR' }: CtaKpiGridProps) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="cta-kpi-grid"
    >
      <KpiCard
        label="Impressions CTA"
        value={totals.impressions}
        format="number"
        loading={loading}
      />
      <KpiCard
        label="Clics CTA"
        value={totals.clicks}
        format="number"
        loading={loading}
      />
      <KpiCard
        label="CR CTA → Achat"
        value={totals.conversionRate}
        format="percent"
        loading={loading}
      />
      <KpiCard
        label="Revenu attribué"
        value={totals.revenueAttributedCents}
        format="currency"
        currency={currency}
        loading={loading}
      />
    </div>
  );
}
