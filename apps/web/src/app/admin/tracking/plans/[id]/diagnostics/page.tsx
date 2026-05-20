import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { StatusBadge } from '@/components/admin/tracking/plans/StatusBadge';
import { getTrackingPlanService } from '@/lib/tracking/plan';
import { computeDrift, type ObservedEvent } from '@/lib/tracking/plan/diagnostics';
import { listEvents } from '@/lib/db/queries/tracking/events-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 7;

async function aggregateObservedEvents(windowStart: Date): Promise<ObservedEvent[]> {
  // listEvents pagine en interne ; pour le drift on prend un échantillon
  // suffisamment large pour couvrir un site faible-trafic. À remplacer par
  // une vraie agrégation SQL (`GROUP BY eventName`) si volumétrie > 5k.
  const rows = await listEvents({ fromDate: windowStart, limit: 5000 });
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.eventName, (counts.get(r.eventName) ?? 0) + 1);
  return Array.from(counts.entries()).map(([eventName, count]) => ({ eventName, count }));
}

export default async function PlanDiagnosticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAdmin(`/admin/tracking/plans/${id}/diagnostics`);
  const service = getTrackingPlanService();
  const plan = await service.get(id);
  if (!plan) return notFound();

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const observed = await aggregateObservedEvents(windowStart);
  const report = computeDrift({ plan, observed, windowStart, windowEnd });

  const driftLevel =
    report.declaredMissing.length === 0 && report.orphans.length === 0
      ? 'none'
      : report.declaredMissing.length > 0
        ? 'warn'
        : 'info';

  return (
    <TrackingShell
      adminEmail={session.email}
      active="plans"
      title={`Diagnostics — ${plan.name}`}
      description={`Drift entre le plan actif et les événements observés (${WINDOW_DAYS}j).`}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={plan.status} />
          <span className="text-xs text-stone-500">
            Fenêtre : {report.windowStart.slice(0, 10)} → {report.windowEnd.slice(0, 10)}
          </span>
          <span className="text-xs text-stone-500">
            Échantillon : {report.observedSampleSize} évts
          </span>
        </div>
        <Link
          href={`/admin/tracking/plans/${plan.id}`}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
        >
          Retour
        </Link>
      </div>

      {driftLevel === 'none' && (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ Aucun drift détecté sur la fenêtre. Tous les événements déclarés sont observés et aucun
          orphelin n&apos;est remonté.
        </p>
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <article>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-stone-500">
            Déclarés mais non vus ({report.declaredMissing.length})
          </h2>
          {report.declaredMissing.length === 0 ? (
            <p className="text-sm text-stone-500">RAS — tous les événements déclarés ont au moins un hit.</p>
          ) : (
            <ul className="divide-y divide-stone-200 rounded-md border border-amber-300 bg-amber-50 text-sm">
              {report.declaredMissing.map((m) => (
                <li key={m.key} className="flex items-center justify-between px-3 py-2">
                  <span className="font-mono text-amber-900">{m.key}</span>
                  <span className="flex gap-1 text-xs text-amber-700">
                    {m.providers.map((p) => (
                      <span key={p} className="rounded-full bg-amber-100 px-2 py-0.5">
                        {p}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-stone-500">
            Probable cause : l&apos;événement est déclaré au plan mais le code de tracking ne l&apos;émet pas
            (ou n&apos;est pas déployé).
          </p>
        </article>

        <article>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-stone-500">
            Orphelins observés ({report.orphans.length})
          </h2>
          {report.orphans.length === 0 ? (
            <p className="text-sm text-stone-500">RAS — aucun event log hors-plan.</p>
          ) : (
            <ul className="divide-y divide-stone-200 rounded-md border border-sky-300 bg-sky-50 text-sm">
              {report.orphans.map((o) => (
                <li key={o.key} className="flex items-center justify-between px-3 py-2">
                  <span className="font-mono text-sky-900">{o.key}</span>
                  <span className="text-xs text-sky-700">{o.observedCount} hits</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-stone-500">
            Probable cause : l&apos;événement est émis par le code mais absent du plan. À ajouter ou à
            renommer si typo.
          </p>
        </article>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-stone-500">
          Événements couverts ({report.covered.length})
        </h2>
        {report.covered.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun événement couvert sur la fenêtre.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white text-sm">
            {report.covered.map((c) => (
              <li key={c.key} className="flex items-center justify-between px-3 py-2">
                <span className="font-mono text-stone-900">{c.key}</span>
                <span className="text-xs text-stone-500">{c.observedCount} hits</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </TrackingShell>
  );
}
