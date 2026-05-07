/**
 * /admin/analytics/funnel — Onglet Funnel.
 * cf. docs/analytics/05-onglets-specs.md §3
 *
 * RSC qui pré-charge l'overview + sankey + DataTable en parallèle, puis remet
 * la main au `<FunnelDashboard>` client (qui refetch quand les filtres URL
 * changent).
 */
import { Suspense } from 'react';

import { FunnelDashboard } from '@/components/admin/analytics/funnel';
import { parseFiltersFromSearchParams } from '@/lib/analytics/filters';
import {
  getFunnelByPage,
  getFunnelOverview,
  getFunnelSankey,
} from '@/lib/analytics/queries/funnel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function AnalyticsFunnelPage({ searchParams }: PageProps) {
  const filters = parseFiltersFromSearchParams(searchParams);
  return (
    <Suspense fallback={<FunnelSkeleton />}>
      <FunnelContent filters={filters} />
    </Suspense>
  );
}

async function FunnelContent({
  filters,
}: {
  filters: ReturnType<typeof parseFiltersFromSearchParams>;
}) {
  const [overview, sankey, byPage] = await Promise.all([
    getFunnelOverview(filters),
    getFunnelSankey(filters),
    getFunnelByPage(filters),
  ]);

  return (
    <FunnelDashboard
      initialFilters={filters}
      initialOverview={overview}
      initialSankey={sankey}
      initialByPage={byPage}
    />
  );
}

function FunnelSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="funnel-skeleton">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg bg-stone-200" />
        <div className="h-72 animate-pulse rounded-lg bg-stone-200" />
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-stone-200" />
      <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
    </div>
  );
}
