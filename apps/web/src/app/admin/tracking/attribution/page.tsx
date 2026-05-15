import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { AttributionSettingsClient } from '@/components/admin/tracking/attribution/AttributionSettingsClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TrackingAttributionPage() {
  const session = await requireAdmin('/admin/tracking/attribution');
  return (
    <TrackingShell
      adminEmail={session.email}
      active="attribution"
      title="Attribution multi-canal"
      description="Comment FemiGlow décide à quel canal publicitaire envoyer chaque conversion."
    >
      <AttributionSettingsClient />
    </TrackingShell>
  );
}
