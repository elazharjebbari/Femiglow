import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { AttributionSettingsClient } from '@/components/admin/tracking/attribution/AttributionSettingsClient';
import { getAttributionStrategy } from '@/lib/tracking/attribution/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TrackingAttributionPage() {
  const session = await requireAdmin('/admin/tracking/attribution');
  const initialStrategy = await getAttributionStrategy();
  return (
    <TrackingShell
      adminEmail={session.email}
      active="attribution"
      title="Attribution multi-canal"
      description="Comment FemiGlow décide à quel canal publicitaire envoyer chaque conversion."
    >
      <AttributionSettingsClient initialStrategy={initialStrategy} />
    </TrackingShell>
  );
}
