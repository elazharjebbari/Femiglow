/**
 * /admin/analytics/insights — Module Analytics Insights.
 *
 * NOTE shell : le layout parent `app/admin/analytics/layout.tsx` rend déjà
 * l'`AdminShell` (active=analytics) + l'`AnalyticsTabs` + la `FilterBar`.
 * Cette page enfant ne doit donc PAS re-rendre `AdminShell` — sinon double
 * imbrication (deux sidebars/headers admin l'un dans l'autre).
 *
 * cf. docs/analytics-insights/
 */
import { requireAdmin } from '@/lib/auth/require-admin';
import { InsightsView } from '@/components/admin/analytics/insights/InsightsView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InsightsPage() {
  // Auth est aussi vérifiée par le layout parent ; on conserve cet appel
  // ici pour ne pas dépendre de l'ordre exact d'exécution Next.js et pour
  // que la page reste self-contained pour les tests.
  await requireAdmin('/admin/analytics/insights');
  return <InsightsView />;
}
