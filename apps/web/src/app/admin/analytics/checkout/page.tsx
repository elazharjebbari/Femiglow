/**
 * /admin/analytics/checkout — Onglet Checkout.
 * cf. docs/analytics/05-onglets-specs.md §5
 *
 * RSC qui pré-charge `getCheckoutData(filters)` et le passe au
 * `<CheckoutDashboard>` client.
 */
import { Suspense } from 'react';

import { CheckoutDashboard } from '@/components/admin/analytics/checkout';
import { parseFiltersFromSearchParams } from '@/lib/analytics/filters';
import { getCheckoutData } from '@/lib/analytics/queries/checkout';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function AnalyticsCheckoutPage({ searchParams }: PageProps) {
  const filters = parseFiltersFromSearchParams(searchParams);
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent filters={filters} />
    </Suspense>
  );
}

async function CheckoutContent({
  filters,
}: {
  filters: ReturnType<typeof parseFiltersFromSearchParams>;
}) {
  const data = await getCheckoutData(filters);
  return <CheckoutDashboard initialFilters={filters} initialData={data} />;
}

function CheckoutSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="checkout-skeleton">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-stone-200" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg bg-stone-200" />
        <div className="h-72 animate-pulse rounded-lg bg-stone-200" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
        <div className="h-64 animate-pulse rounded-lg bg-stone-200" />
      </div>
    </div>
  );
}
