import { requireAdmin } from '@/lib/auth/require-admin';
import { listTrackingProviders } from '@/lib/db/queries/tracking/providers';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { ProviderConfigList } from '@/components/admin/tracking/ProviderConfigList';

export const dynamic = 'force-dynamic';

export default async function TrackingProvidersPage() {
  const session = await requireAdmin('/admin/tracking/providers');
  const providers = await listTrackingProviders();
  const hasEnvSnapToken = !!process.env.SNAP_CAPI_TOKEN && process.env.SNAP_CAPI_TOKEN.length > 0;

  return (
    <TrackingShell
      adminEmail={session.email}
      active="providers"
      title="Providers"
      description="Configuration des pixels, tokens CAPI et modes d'envoi."
    >
      <ProviderConfigList
        providers={providers.map((p) => ({
          kind: p.kind,
          status: p.status,
          pixelId: p.pixelId,
          hasCapiToken: p.capiToken != null && p.capiToken !== '',
          testEventCode: p.testEventCode,
          enabledEvents: p.enabledEvents ?? [],
          lastEventAt: p.lastEventAt?.toISOString() ?? null,
          errorCount24h: p.errorCount24h,
          lastError: p.lastError,
          updatedAt: p.updatedAt.toISOString(),
        }))}
        hasEnvSnapToken={hasEnvSnapToken}
      />
    </TrackingShell>
  );
}