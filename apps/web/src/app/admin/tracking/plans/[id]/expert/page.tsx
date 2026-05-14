import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { getTrackingPlanService } from '@/lib/tracking/plan';
import { ExpertEditor } from './ExpertEditor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ExpertModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAdmin(`/admin/tracking/plans/${id}/expert`);
  const service = getTrackingPlanService();
  const plan = await service.get(id);
  if (!plan) return notFound();

  const initialDraft = {
    name: plan.name,
    providers: plan.providers,
    envProfiles: plan.envProfiles,
    events: plan.events,
    settings: plan.settings,
  };

  return (
    <TrackingShell
      adminEmail={session.email}
      active="plans"
      title={`Mode expert — ${plan.name}`}
      description="Édition JSON brute. Validation Zod côté serveur, optimistic concurrency via If-Match."
    >
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={`/admin/tracking/plans/${plan.id}`}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
        >
          ‹ Vue normale
        </Link>
        <span className="text-xs text-stone-500">
          Version actuelle : <strong>v{plan.version}</strong>
        </span>
      </div>

      <ExpertEditor planId={plan.id} initialVersion={plan.version} initialDraft={initialDraft} />
    </TrackingShell>
  );
}
