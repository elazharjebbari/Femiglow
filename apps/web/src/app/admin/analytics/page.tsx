/**
 * /admin/analytics — Vue d'ensemble.
 * cf. docs/analytics/05-onglets-specs.md §1
 *
 * RSC qui charge les KPI + séries via getOverviewData. Le client lit les
 * filtres depuis l'URL (searchParams), ce qui évite un fetch supplémentaire
 * côté browser pour le premier render.
 */
import { Suspense } from 'react';

import { parseFiltersFromSearchParams } from '@/lib/analytics/filters';
import { getOverviewData } from '@/lib/analytics/queries/overview';

import { OverviewKpiGrid } from '@/components/admin/analytics/overview/OverviewKpiGrid';
import { OverviewSessionsChart } from '@/components/admin/analytics/overview/OverviewSessionsChart';
import { OverviewTopPages } from '@/components/admin/analytics/overview/OverviewTopPages';
import { OverviewTopSources } from '@/components/admin/analytics/overview/OverviewTopSources';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function AnalyticsOverviewPage({ searchParams }: PageProps) {
  const filters = parseFiltersFromSearchParams(searchParams);
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewContent filters={filters} />
    </Suspense>
  );
}

async function OverviewContent({
  filters,
}: {
  filters: ReturnType<typeof parseFiltersFromSearchParams>;
}) {
  const data = await getOverviewData(filters);
  return (
    <div className="flex flex-col gap-6" data-testid="overview-page">
      <OverviewKpiGrid data={data.kpis} />
      <OverviewSessionsChart series={data.series} granularity={data.range.granularity} />
      <div className="grid gap-6 lg:grid-cols-2">
        <OverviewTopSources rows={data.topSources} />
        <OverviewTopPages rows={data.topPages} />
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="overview-skeleton">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-stone-200" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-stone-200" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
        <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
      </div>
    </div>
  );
}
