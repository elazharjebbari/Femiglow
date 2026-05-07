/**
 * OverviewKpiGrid — grille des 6 KPI principaux du dashboard analytics.
 * cf. docs/analytics/05-onglets-specs.md §1.2
 */
import { KpiCard } from '../primitives/KpiCard';
import type { OverviewData } from '@/lib/analytics/queries/overview';

interface OverviewKpiGridProps {
  data: OverviewData['kpis'];
  comparisonLabel?: string;
}

export function OverviewKpiGrid({
  data,
  comparisonLabel = 'vs période précédente',
}: OverviewKpiGridProps) {
  return (
    <section
      aria-label="Indicateurs clés"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="overview-kpi-grid"
    >
      <KpiCard
        label="Sessions"
        value={data.sessions.current}
        format="number"
        delta={kpiToDelta(data.sessions.delta)}
        comparisonLabel={comparisonLabel}
        positiveDirection="up"
      />
      <KpiCard
        label="Visiteurs uniques"
        value={data.uniqueVisitors.current}
        format="number"
        delta={kpiToDelta(data.uniqueVisitors.delta)}
        comparisonLabel={comparisonLabel}
        positiveDirection="up"
      />
      <KpiCard
        label="Pages vues"
        value={data.pageViews.current}
        format="number"
        delta={kpiToDelta(data.pageViews.delta)}
        comparisonLabel={comparisonLabel}
        positiveDirection="up"
      />
      <KpiCard
        label="Durée moy. session"
        value={data.avgSessionDuration.current}
        format="duration"
        delta={kpiToDelta(data.avgSessionDuration.delta)}
        comparisonLabel={comparisonLabel}
        positiveDirection="up"
      />
      <KpiCard
        label="Taux de rebond"
        value={data.bounceRate.current}
        format="percent"
        delta={kpiToDelta(data.bounceRate.delta)}
        comparisonLabel={comparisonLabel}
        positiveDirection="down"
      />
      <KpiCard
        label="Taux de conversion"
        value={data.conversionRate.current}
        format="percent"
        delta={kpiToDelta(data.conversionRate.delta)}
        comparisonLabel={comparisonLabel}
        positiveDirection="up"
      />
    </section>
  );
}

function kpiToDelta(delta: number | null): { value: number } | null {
  if (delta === null || Number.isNaN(delta)) return null;
  return { value: delta };
}
