/**
 * /admin/emails/events — Dashboard debug user_event (M5.2.7).
 *
 * Vue admin pour debug du pipeline user_event :
 *   - Compteur total last 24h
 *   - Top events par (event_name, source)
 *   - 100 derniers events bruts (avec properties)
 *
 * Permet de vérifier que les bridges (web/email/server/admin) écrivent
 * bien dans user_event après un trigger de test.
 */
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  getEventCountsByName,
  getRecentEvents,
  getTotalEvents,
} from '@/lib/user-events/queries';

export const dynamic = 'force-dynamic';

const SOURCE_COLORS: Record<string, string> = {
  web: 'bg-sky-50 text-sky-700',
  email: 'bg-emerald-50 text-emerald-700',
  server: 'bg-amber-50 text-amber-700',
  admin: 'bg-violet-50 text-violet-700',
  import: 'bg-stone-100 text-stone-700',
};

function formatTimestamp(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export default async function EventsDebugPage({
  searchParams,
}: {
  searchParams: { source?: string };
}) {
  const session = await requireAdmin('/admin/emails/events');
  const sourceFilter = ['web', 'server', 'email', 'admin', 'import'].includes(
    searchParams.source ?? '',
  )
    ? (searchParams.source as 'web' | 'server' | 'email' | 'admin' | 'import')
    : undefined;

  const [counts, recent, total] = await Promise.all([
    getEventCountsByName(),
    getRecentEvents({ limit: 100, source: sourceFilter }),
    getTotalEvents(),
  ]);

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Events utilisateur (debug)
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Pipeline <code className="font-mono text-xs">user_event</code> — vue de
            contrôle pour vérifier que les bridges (web tracking, email webhooks,
            server actions, admin actions) alimentent bien la table unifiée.
          </p>
        </div>
        <Link href="/admin/emails" className="text-sm text-stone-500 underline">
          ← Dashboard
        </Link>
      </header>

      {/* Total counter */}
      <section className="mb-8 rounded-lg border border-stone-200 bg-white p-6">
        <p className="text-xs uppercase tracking-wider text-stone-500">Total last 24h</p>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-stone-900">
          {total.toLocaleString('fr-FR')}
        </p>
      </section>

      {/* Counts by event_name + source */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-stone-900">
          Top events (last 24h)
        </h2>
        {counts.length === 0 ? (
          <div className="rounded-md border border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-500">
            Aucun event sur les 24 dernières heures.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    Event
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    Source
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-stone-500">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {counts.map((c, i) => (
                  <tr key={`${c.eventName}-${c.source}-${i}`}>
                    <td className="px-3 py-2 font-mono text-xs text-stone-800">
                      {c.eventName}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                          SOURCE_COLORS[c.source] ?? 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {c.source}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.count.toLocaleString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent events stream */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">
            100 derniers events
          </h2>
          <nav className="flex items-center gap-2 text-xs">
            <span className="text-stone-500">Filtrer source :</span>
            <Link
              href="/admin/emails/events"
              className={`rounded px-2 py-1 ${!sourceFilter ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
            >
              Tous
            </Link>
            {(['web', 'email', 'server', 'admin'] as const).map((s) => (
              <Link
                key={s}
                href={`/admin/emails/events?source=${s}`}
                className={`rounded px-2 py-1 ${
                  sourceFilter === s
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {s}
              </Link>
            ))}
          </nav>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-md border border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-500">
            Aucun event ne correspond aux filtres.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500 w-32">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    Email
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    Event
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500 w-24">
                    Source
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    Properties
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50">
                    <td className="px-3 py-2 font-mono text-xs text-stone-600">
                      {formatTimestamp(r.ts)}
                    </td>
                    <td className="px-3 py-2 text-stone-800">{r.email}</td>
                    <td className="px-3 py-2 font-mono text-xs text-stone-800">
                      {r.eventName}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                          SOURCE_COLORS[r.source] ?? 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {r.source}
                      </span>
                    </td>
                    <td className="max-w-md truncate px-3 py-2 font-mono text-xs text-stone-500">
                      {Object.keys(r.properties).length > 0
                        ? JSON.stringify(r.properties)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
