import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { StatusBadge } from '@/components/admin/tracking/plans/StatusBadge';
import { getTrackingPlanService } from '@/lib/tracking/plan';
import { PlanDetailActions } from '@/components/admin/tracking/plans/PlanDetailActions';
import { TrackingHelpPanel } from '@/components/admin/tracking/plans/wizard/TrackingHelpPanel';
import { AudienceStrategyPanel } from '@/components/admin/tracking/plans/wizard/AudienceStrategyPanel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAdmin(`/admin/tracking/plans/${id}`);
  const service = getTrackingPlanService();
  const plan = await service.get(id);
  if (!plan) return notFound();

  const validation = await service.validate(id).catch(() => null);
  const activeProviders = plan.providers.filter((p) => p.active);
  const prod = plan.envProfiles.find((p) => p.env === 'production');

  return (
    <TrackingShell
      adminEmail={session.email}
      active="plans"
      title={plan.name}
      description={`Plan v${plan.version} — créé le ${plan.createdAt.toLocaleDateString('fr-FR')}.`}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={plan.status} />
          <span className="text-xs text-stone-500">
            Mis à jour {plan.updatedAt.toLocaleString('fr-FR')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/tracking/plans/${plan.id}/expert`}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Mode expert
          </Link>
          <Link
            href={`/admin/tracking/plans/${plan.id}/history`}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Historique
          </Link>
          <Link
            href={`/admin/tracking/plans/${plan.id}/diagnostics`}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Diagnostics
          </Link>
          <Link
            href="/admin/tracking/plans"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            Retour
          </Link>
        </div>
      </div>

      <PlanDetailActions
        planId={plan.id}
        status={plan.status}
        version={plan.version}
        validationOk={validation?.ok ?? null}
      />

      <div className="mt-6 space-y-4">
        <TrackingHelpPanel />
        <AudienceStrategyPanel />
      </div>

      {validation && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-stone-500">
            Validation
          </h2>
          {validation.errors.length === 0 ? (
            <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✓ Plan valide — prêt pour activation.
            </p>
          ) : (
            <ul className="space-y-1 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
              {validation.errors.map((e, i) => (
                <li key={i}>
                  <strong>{e.code}</strong> · {e.message}
                  {e.path && <code className="ml-2 text-xs text-rose-600">{e.path}</code>}
                </li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              {validation.warnings.map((w, i) => (
                <li key={i}>
                  <strong>{w.code}</strong> · {w.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-stone-500">
            Outils actifs
          </h2>
          {activeProviders.length === 0 ? (
            <p className="text-sm text-stone-500">Aucun outil activé.</p>
          ) : (
            <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white text-sm">
              {activeProviders.map((p) => (
                <li key={p.id} className="px-3 py-2">
                  {p.id}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-stone-500">
            Identifiants production
          </h2>
          {prod ? (
            <dl className="rounded-md border border-stone-200 bg-white p-3 text-sm">
              {Object.entries(prod.config)
                .filter(([, v]) => !!v)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 py-0.5">
                    <dt className="text-stone-500">{k}</dt>
                    <dd className="font-mono text-stone-900">{String(v)}</dd>
                  </div>
                ))}
            </dl>
          ) : (
            <p className="text-sm text-stone-500">Profil production manquant.</p>
          )}
        </article>
      </section>

      <section className="mt-8 rounded-md border border-sky-200 bg-sky-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-sky-800">
              Mapping enrichi (sémantique par provider)
            </h2>
            <p className="mt-1 text-sm text-sky-900">
              Le plan définit <strong>quels</strong> événements partent vers quels outils.
              Le mapping complète avec le <strong>comment</strong> (renommage par provider,
              flag custom, désactivation ponctuelle, notes). À utiliser quand un événement
              doit porter un nom différent par destination (ex. <code>purchase</code> → <code>Purchase</code> côté Meta).
            </p>
          </div>
          <Link
            href="/admin/tracking/events/mappings"
            className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-sm font-medium text-sky-800 hover:bg-sky-100"
          >
            Ouvrir le mapping →
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-stone-500">
          Événements ({plan.events.length})
        </h2>
        {plan.events.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun événement défini.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white text-sm">
            {plan.events.map((e) => (
              <li
                key={e.key}
                className="flex items-center justify-between px-3 py-2"
              >
                <span className="font-mono text-stone-900">{e.key}</span>
                <span className="flex gap-1 text-xs text-stone-500">
                  {Object.entries(e.providers)
                    .filter(([, v]) => v)
                    .map(([p]) => (
                      <span
                        key={p}
                        className="rounded-full bg-stone-100 px-2 py-0.5"
                      >
                        {p}
                      </span>
                    ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </TrackingShell>
  );
}
