import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { getTrackingPlanService } from '@/lib/tracking/plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTION_LABELS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  activate: 'Activation',
  archive: 'Archivage',
  rollback: 'Rollback',
};

export default async function PlanHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAdmin(`/admin/tracking/plans/${id}/history`);
  const service = getTrackingPlanService();
  const plan = await service.get(id);
  if (!plan) return notFound();
  const entries = await service.history(id);

  return (
    <TrackingShell
      adminEmail={session.email}
      active="plans"
      title={`Historique — ${plan.name}`}
      description={`${entries.length} action(s) consignée(s).`}
    >
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={`/admin/tracking/plans/${plan.id}`}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
        >
          ‹ Plan
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-stone-500">Aucune entrée d'audit pour ce plan.</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-stone-900">
                  {ACTION_LABELS[e.action] ?? e.action}
                </span>
                <span className="text-xs text-stone-500">
                  {new Date(e.createdAt).toLocaleString('fr-FR')}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-600">
                par <code className="text-stone-900">{e.actorEmail}</code>
              </p>
              {e.meta && Object.keys(e.meta).length > 0 && (
                <details className="mt-2 text-xs text-stone-500">
                  <summary className="cursor-pointer">Détails</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-stone-50 p-2 font-mono">
                    {JSON.stringify(e.meta, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </TrackingShell>
  );
}
