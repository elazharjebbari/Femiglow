import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { ProvidersPanel } from '@/components/admin/tracking/ProvidersPanel';

export const dynamic = 'force-dynamic';

export default async function TrackingProvidersPage() {
  const session = await requireAdmin('/admin/tracking/providers');
  return (
    <TrackingShell
      adminEmail={session.email}
      active="providers"
      title="Pixels & Conversions"
      description="Configurer les fournisseurs (Meta, Google, TikTok, Snap, Pinterest, GTM, custom)."
    >
      <ProvidersPanel />
    </TrackingShell>
  );
}
