/**
 * /admin/analytics/cta — Onglet CTA.
 * cf. docs/analytics/05-onglets-specs.md §4
 *
 * RSC qui pré-charge `getCtaData(filters)` et le passe au `<CtaDashboard>`
 * client. La devise EUR est par défaut.
 */
import { Suspense } from 'react';

import { CtaDashboard } from '@/components/admin/analytics/cta';
import { parseFiltersFromSearchParams } from '@/lib/analytics/filters';
import { getCtaData } from '@/lib/analytics/queries/cta';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function AnalyticsCtaPage({ searchParams }: PageProps) {
  const filters = parseFiltersFromSearchParams(searchParams);
  return (
    <Suspense fallback={<CtaSkeleton />}>
      <CtaContent filters={filters} />
    </Suspense>
  );
}

async function CtaContent({
  filters,
}: {
  filters: ReturnType<typeof parseFiltersFromSearchParams>;
}) {
  const data = await getCtaData(filters);
  return <CtaDashboard initialFilters={filters} initialData={data} />;
}

function CtaSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="cta-skeleton">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-stone-200" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-lg bg-stone-200" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
        <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
      </div>
    </div>
  );
}
