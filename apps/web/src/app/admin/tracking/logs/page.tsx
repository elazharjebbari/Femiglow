import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { LogsPanel } from '@/components/admin/tracking/LogsPanel';

export const dynamic = 'force-dynamic';

export default async function TrackingLogsPage() {
  const session = await requireAdmin('/admin/tracking/logs');
  return (
    <TrackingShell
      adminEmail={session.email}
      active="logs"
      title="Logs"
      description="Flux temps réel des événements (polling 5 s)."
    >
      <LogsPanel />
    </TrackingShell>
  );
}
