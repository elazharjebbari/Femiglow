import { requireAdmin } from '@/lib/auth/require-admin';
import { TrackingShell } from '@/components/admin/tracking/TrackingShell';
import { listEvents, countEventsSince } from '@/lib/db/queries/tracking/events-log';
import { listTrackingProviders } from '@/lib/db/queries/tracking/providers';
import { listTrackingComponents } from '@/lib/db/queries/tracking/components';
import { listTrackingPages } from '@/lib/db/queries/tracking/pages';

export const dynamic = 'force-dynamic';

export default async function TrackingDashboardPage() {
  const session = await requireAdmin('/admin/tracking');
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [events24h, recent, providers, components, pages] = await Promise.all([
    countEventsSince(last24h),
    listEvents({ limit: 10 }),
    listTrackingProviders(),
    listTrackingComponents(),
    listTrackingPages(),
  ]);
  const enabledProviders = providers.filter((p) => p.status === 'enabled').length;
  const conversions24h = recent.filter((e) => e.isConversion).length;

  return (
    <TrackingShell
      adminEmail={session.email}
      active="dashboard"
      title="Vue d’ensemble"
      description="Activité tracking des dernières 24 heures."
    >
      <div className="mb-4 flex items-center justify-end">
        <form action="/api/admin/tracking/seed-defaults" method="POST">
          <button
            type="submit"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
            title="Re-seed les event mappings + providers analytics par défaut"
          >
            Seed défauts (events + providers)
          </button>
        </form>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Événements (24h)" value={events24h} />
        <Kpi label="Conversions récentes" value={conversions24h} />
        <Kpi label="Pixels actifs" value={enabledProviders} suffix={` / ${providers.length}`} />
        <Kpi label="Pages × composants" value={pages.length} suffix={` × ${components.length}`} />
      </div>
      <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-stone-500">
        Derniers événements
      </h2>
      {recent.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">Aucun événement encore.</p>
      ) : (
        <ul className="mt-3 divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
          {recent.map((e) => (
            <li key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-stone-900">{e.eventName}</p>
                <p className="text-xs text-stone-500">
                  {e.pageRoute} · {new Date(e.receivedAt).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-2 py-1 font-mono text-[11px] text-stone-600">
                {e.eventCategory}
              </span>
            </li>
          ))}
        </ul>
      )}
    </TrackingShell>
  );
}

function Kpi({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
        {value}
        {suffix ? <span className="text-sm font-normal text-stone-400">{suffix}</span> : null}
      </p>
    </div>
  );
}
