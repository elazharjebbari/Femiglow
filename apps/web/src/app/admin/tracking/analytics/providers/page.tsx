import { Metadata } from 'next';
import { ProvidersAnalyticsTable } from '@/components/admin/tracking/analytics/ProvidersAnalyticsTable';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analytics Providers — Tracking',
};

/**
 * Page admin /admin/tracking/analytics/providers (T31 + C4.F.1).
 *
 * Affiche les métriques ROI/health par provider (success rate, latence,
 * erreurs, conversions) sur 7 jours. Refresh auto 30s côté client.
 * Aucune table dérivée — agrégation directe sur tracking_events_log.
 */
export default function AnalyticsProvidersPage() {
  return (
    <main className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-stone-900">
          Analytics Providers
        </h1>
        <p className="text-sm text-stone-500">
          Health et ROI par provider sur les 7 derniers jours. Total events,
          taux de succès, latence moyenne, conversions. Refresh automatique
          toutes les 30 secondes.
        </p>
      </header>
      <ProvidersAnalyticsTable />
    </main>
  );
}
