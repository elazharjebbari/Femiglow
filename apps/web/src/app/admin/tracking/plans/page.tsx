import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { StatusBadge } from '@/components/admin/tracking/plans/StatusBadge';
import { getTrackingPlanService } from '@/lib/tracking/plan';
import { SeedCanonicalButton } from '@/components/admin/tracking/plans/SeedCanonicalButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TrackingPlansHome() {
  const session = await requireAdmin('/admin/tracking/plans');
  const service = getTrackingPlanService();
  const plans = await service.list();
  const active = plans.find((p) => p.status === 'active') ?? null;

  return (
    <TrackingShell
      adminEmail={session.email}
      active="plans"
      title="Plans tracking (unifié)"
      description="Une seule source de vérité pour GA4, Ads, Meta, TikTok et GTM."
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="text-sm text-stone-600">
          {plans.length === 0
            ? 'Aucun plan pour le moment. Démarrez via le wizard.'
            : `${plans.length} plan(s) — ${active ? 'un actif détecté' : 'aucun actif'}.`}
        </div>
        <div className="flex items-center gap-2">
          <SeedCanonicalButton />
          <Link
            href="/admin/tracking/plans/new"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Nouveau plan
          </Link>
        </div>
      </div>

      {active && (
        <section className="mb-8 rounded-md border border-emerald-300 bg-emerald-50/60 p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-emerald-800">
            Plan actif
          </h2>
          <p className="mt-1 text-base font-semibold text-emerald-950">{active.name}</p>
          <p className="mt-1 text-xs text-emerald-800">
            v{active.version} · mis à jour {active.updatedAt.toLocaleString('fr-FR')}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href={`/admin/tracking/plans/${active.id}`}
              className="rounded border border-emerald-700 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
            >
              Ouvrir
            </Link>
            <Link
              href={`/admin/tracking/plans/${active.id}/expert`}
              className="rounded border border-emerald-700 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
            >
              Mode expert
            </Link>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
          Tous les plans
        </h2>
        {plans.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            Cliquez sur <strong>Nouveau plan</strong> pour démarrer.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
            {plans.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-stone-900">{p.name}</p>
                  <p className="text-xs text-stone-500">
                    v{p.version} · {p.events.length} événement(s) ·{' '}
                    {p.updatedAt.toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <Link
                    href={`/admin/tracking/plans/${p.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    Ouvrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </TrackingShell>
  );
}
