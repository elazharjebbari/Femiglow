import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { getTrackingPlanService } from '@/lib/tracking/plan';
import type { TrackingPlanInput } from '@/lib/tracking/plan/types';
import { WizardClient } from '../../new/WizardClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function EditTrackingPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAdmin(`/admin/tracking/plans/${id}/edit`);
  const service = getTrackingPlanService();
  const plan = await service.get(id);
  if (!plan) return notFound();

  const initial: TrackingPlanInput = {
    name: plan.name,
    providers: plan.providers,
    envProfiles: plan.envProfiles,
    events: plan.events,
    settings: plan.settings ?? {},
  };

  return (
    <TrackingShell
      adminEmail={session.email}
      active="plans"
      title={`Éditer : ${plan.name}`}
      description={`v${plan.version} — modifications enregistrées avec If-Match (concurrence optimiste).`}
    >
      <WizardClient
        mode="edit"
        initialPlan={initial}
        planId={plan.id}
        expectedVersion={plan.version}
      />
    </TrackingShell>
  );
}
