/**
 * /admin/analytics/insights — Module Analytics Insights.
 * cf. docs/analytics-insights/
 */
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { InsightsView } from '@/components/admin/analytics/insights/InsightsView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InsightsPage() {
  const session = await requireAdmin('/admin/analytics/insights');
  return (
    <AdminShell adminEmail={session.email} active="analytics">
      <InsightsView />
    </AdminShell>
  );
}
