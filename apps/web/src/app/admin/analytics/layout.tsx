/**
 * Layout commun aux pages /admin/analytics/*.
 * cf. docs/analytics/04-ui-design.md §3
 *
 * Structure : AdminShell (active=analytics) → AnalyticsTabs → FilterBar →
 * children. Les FilterBar et AnalyticsTabs lisent les query params via le
 * hook useAnalyticsFilters.
 */
import type { ReactNode } from 'react';

import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { AnalyticsTabs } from '@/components/admin/analytics/primitives/AnalyticsTabs';
import { FilterBar } from '@/components/admin/analytics/primitives/FilterBar';
import { RefreshStatsButton } from '@/components/admin/analytics/primitives/RefreshStatsButton';

export const dynamic = 'force-dynamic';

export default async function AnalyticsLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin('/admin/analytics');
  return (
    <AdminShell adminEmail={session.email} active="analytics">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-stone-900">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Mesure du parcours visiteur et de la conversion.
          </p>
        </div>
        <RefreshStatsButton />
      </header>
      <AnalyticsTabs />
      <FilterBar />
      <div className="mt-6">{children}</div>
    </AdminShell>
  );
}
