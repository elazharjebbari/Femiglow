import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { TestPanel } from '@/components/admin/tracking/TestPanel';

export const dynamic = 'force-dynamic';

export default async function TrackingTestPage() {
  const session = await requireAdmin('/admin/tracking/test');
  return (
    <TrackingShell
      adminEmail={session.email}
      active="test"
      title="Tester un événement"
      description="Simuler un dispatch (dry-run) ou envoyer réellement aux pixels actifs."
    >
      <TestPanel />
    </TrackingShell>
  );
}
