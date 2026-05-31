/**
 * /admin/live-health — dashboard santé live cross-système.
 *
 * Référence : `docs/live-systems-fix-2026-05/03-plan-action-phases.md` § R4
 *
 * Agrège les 3 systèmes live (chat, publishing, tracking) en une page
 * unique pour l'admin. Alertes globales en tête, détails par section.
 *
 * Server Component — calls `getLiveHealthSnapshot()` qui combine :
 *   - Redis metrics chat (streaming, breakers)
 *   - DB queries publishing (status, dead letters)
 *   - Redis buffer sizes CAPI tracking
 *
 * Performance : ~3 round-trips Redis + 1 query DB. OK pour polling 30s.
 */
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  getLiveHealthSnapshot,
  type HealthAlert,
} from '@/lib/admin/live-health-aggregator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TZ = 'Europe/Paris';

export default async function LiveHealthPage() {
  const session = await requireAdmin('/admin/live-health');

  const snapshot = await getLiveHealthSnapshot();

  return (
    <AdminShell adminEmail={session.email} active="analytics">
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-stone-900">
            Santé Live — Vue unifiée
          </h1>
          <p className="text-sm text-stone-500">
            Snapshot{' '}
            {new Date(snapshot.asOf).toLocaleString('fr-FR', { timeZone: TZ })}
            {' · '}
            Chat + Publishing + Tracking
          </p>
        </header>

        {/* Alertes globales en tête */}
        {snapshot.alerts.length > 0 ? (
          <AlertsPanel alerts={snapshot.alerts} />
        ) : (
          <section className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-medium text-emerald-900">
              ✅ Aucune alerte — tous les systèmes sont sains
            </p>
          </section>
        )}

        {/* Chat */}
        <section
          aria-label="Santé chat"
          className="space-y-3 rounded-md border border-stone-200 bg-white p-5"
        >
          <header className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              💬 Chat live
            </h2>
            <span className="text-xs text-stone-500">
              Streaming + circuit breakers
            </span>
          </header>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat
              label="Streams 60min"
              value={snapshot.chat.totalStreamsLast60min}
            />
            <Stat
              label="Drop rate"
              value={`${snapshot.chat.overallDropRatePct}%`}
              variant={
                snapshot.chat.overallDropRatePct > 10
                  ? 'critical'
                  : snapshot.chat.overallDropRatePct > 5
                    ? 'warning'
                    : 'success'
              }
            />
            <Stat
              label="Providers actifs"
              value={`${snapshot.chat.breakers.filter((b) => b.state === 'CLOSED').length}/${snapshot.chat.breakers.length}`}
              variant={
                snapshot.chat.breakers.some((b) => b.state === 'OPEN')
                  ? 'critical'
                  : 'success'
              }
            />
          </div>

          {snapshot.chat.breakers.length > 0 ? (
            <div className="border-t border-stone-100 pt-3">
              <p className="text-xs uppercase tracking-wide text-stone-500">
                État providers
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {snapshot.chat.breakers.map((b) => (
                  <BreakerBadge
                    key={b.providerId}
                    providerId={b.providerId}
                    state={b.state}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Publishing */}
        <section
          aria-label="Santé publishing"
          className="space-y-3 rounded-md border border-stone-200 bg-white p-5"
        >
          <header className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              📢 Publishing social
            </h2>
            <a
              href="/admin/content-studio/health"
              className="text-xs text-stone-700 underline hover:text-stone-900"
            >
              Voir détails →
            </a>
          </header>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="In flight" value={snapshot.publishing.inFlight} />
            <Stat
              label="Dead letters"
              value={snapshot.publishing.deadLetters}
              variant={
                snapshot.publishing.deadLetters > 0 ? 'critical' : 'success'
              }
            />
            <Stat
              label="Success rate"
              value={`${snapshot.publishing.successRatePct}%`}
              variant={
                snapshot.publishing.successRatePct < 90 &&
                snapshot.publishing.totalJobs > 5
                  ? 'warning'
                  : 'neutral'
              }
            />
            <Stat
              label="Latence P95"
              value={
                snapshot.publishing.latencyP95Ms
                  ? `${(snapshot.publishing.latencyP95Ms / 1000).toFixed(1)}s`
                  : '—'
              }
            />
          </div>
        </section>

        {/* Tracking */}
        <section
          aria-label="Santé tracking"
          className="space-y-3 rounded-md border border-stone-200 bg-white p-5"
        >
          <header className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              📊 Tracking real-time
            </h2>
            <a
              href="/admin/analytics"
              className="text-xs text-stone-700 underline hover:text-stone-900"
            >
              Voir analytics →
            </a>
          </header>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Total buffered"
              value={snapshot.tracking.totalBufferedEvents}
              variant={
                snapshot.tracking.totalBufferedEvents > 1000
                  ? 'critical'
                  : snapshot.tracking.totalBufferedEvents > 500
                    ? 'warning'
                    : 'success'
              }
            />
            {snapshot.tracking.bufferSizesByProvider.map((p) => (
              <Stat
                key={p.provider}
                label={p.provider}
                value={p.size}
                variant={p.size > 500 ? 'warning' : 'neutral'}
              />
            ))}
          </div>
        </section>

        <footer className="border-t border-stone-200 pt-4 text-xs text-stone-500">
          <p>
            Page rafraîchie à chaque visite. Liens connexes :{' '}
            <a
              href="/admin/content-studio/health"
              className="text-stone-700 underline"
            >
              Publishing détails
            </a>
            {' · '}
            <a href="/admin/analytics" className="text-stone-700 underline">
              Analytics
            </a>
            {' · '}
            <a href="/admin/chat" className="text-stone-700 underline">
              Chat
            </a>
          </p>
          <p className="mt-2 text-stone-400">
            Source de vérité : Redis (Upstash) + DB Postgres. Pour audit,
            référencer `docs/live-systems-fix-2026-05/`.
          </p>
        </footer>
      </div>
    </AdminShell>
  );
}

interface StatProps {
  label: string;
  value: string | number;
  variant?: 'neutral' | 'success' | 'warning' | 'critical';
}

function Stat({ label, value, variant = 'neutral' }: StatProps) {
  const valueClasses: Record<NonNullable<StatProps['variant']>, string> = {
    neutral: 'text-stone-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    critical: 'text-red-700',
  };
  return (
    <div>
      <p
        className={`text-2xl font-semibold tabular-nums ${valueClasses[variant]}`}
      >
        {value}
      </p>
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
    </div>
  );
}

function BreakerBadge({
  providerId,
  state,
}: {
  providerId: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}) {
  const styles: Record<typeof state, string> = {
    CLOSED: 'bg-emerald-100 text-emerald-800',
    OPEN: 'bg-red-100 text-red-800 font-bold',
    HALF_OPEN: 'bg-amber-100 text-amber-800',
  };
  const symbols: Record<typeof state, string> = {
    CLOSED: '✓',
    OPEN: '⚠',
    HALF_OPEN: '↻',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${styles[state]}`}
    >
      <span aria-hidden="true">{symbols[state]}</span>
      <span className="font-mono">{providerId}</span>
      <span className="ml-1">{state}</span>
    </span>
  );
}

function AlertsPanel({ alerts }: { alerts: HealthAlert[] }) {
  const critical = alerts.filter((a) => a.level === 'critical');
  const warning = alerts.filter((a) => a.level === 'warning');
  const info = alerts.filter((a) => a.level === 'info');

  return (
    <section aria-label="Alertes" className="space-y-3">
      {critical.length > 0 ? (
        <div className="rounded-md border-l-4 border-red-600 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-red-900">
            🚨 Critical ({critical.length})
          </h2>
          <ul className="space-y-1">
            {critical.map((a, i) => (
              <li key={i} className="text-sm text-red-900">
                <span className="mr-2 inline-block min-w-[80px] text-xs uppercase">
                  [{a.system}]
                </span>
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {warning.length > 0 ? (
        <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-900">
            ⚠️ Warning ({warning.length})
          </h2>
          <ul className="space-y-1">
            {warning.map((a, i) => (
              <li key={i} className="text-sm text-amber-900">
                <span className="mr-2 inline-block min-w-[80px] text-xs uppercase">
                  [{a.system}]
                </span>
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {info.length > 0 ? (
        <div className="rounded-md border-l-4 border-blue-300 bg-blue-50 p-4">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-blue-900">
            ℹ️ Info ({info.length})
          </h2>
          <ul className="space-y-1">
            {info.map((a, i) => (
              <li key={i} className="text-sm text-blue-900">
                <span className="mr-2 inline-block min-w-[80px] text-xs uppercase">
                  [{a.system}]
                </span>
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
