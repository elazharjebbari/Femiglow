import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { WizardClient } from './WizardClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function NewTrackingPlanPage() {
  const session = await requireAdmin('/admin/tracking/plans/new');
  return (
    <TrackingShell
      adminEmail={session.email}
      active="plans"
      title="Nouveau plan tracking"
      description="Configurez votre stack analytics en 5 étapes guidées."
    >
      <WizardClient />
    </TrackingShell>
  );
}
