import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { InventoryPanel } from '@/components/admin/tracking/InventoryPanel';

export const dynamic = 'force-dynamic';

export default async function TrackingInventoryPage() {
  const session = await requireAdmin('/admin/tracking/inventory');
  return (
    <TrackingShell
      adminEmail={session.email}
      active="inventory"
      title="Inventaire"
      description="Composants et pages détectés par le scanner. Diff vs base."
    >
      <InventoryPanel />
    </TrackingShell>
  );
}
