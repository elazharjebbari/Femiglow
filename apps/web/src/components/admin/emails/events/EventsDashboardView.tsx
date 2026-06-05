/**
 * Vue présentationnelle du dashboard debug `user_event`
 * (`/admin/emails/events`) — extraite de `page.tsx` pour être rendue/testée en
 * isolation (jsdom).
 *
 * Reçoit les 3 jeux de données déjà lus côté RSC (counts/recent/total) + le
 * filtre source courant. Apporte les améliorations VAGUE 4 :
 *  - libellés 100 % FR (UX-DASH-009) ;
 *  - bouton de filtre « import » (UX-DASH-007) ;
 *  - lignes « Top events » cliquables → drill-down par source (UX-DASH-008) ;
 *  - compteur total cliquable vers le stream non filtré (UX-DASH-008).
 */
import Link from 'next/link';
import type {
  EventCountByName,
  RecentEvent,
} from '@/lib/user-events/queries';

export const EVENT_SOURCES = ['web', 'email', 'server', 'admin', 'import'] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

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

function SourcePill({ source }: { source: string }) {
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
        SOURCE_COLORS[source] ?? 'bg-stone-100 text-stone-700'
      }`}
    >
      {source}
    </span>
  );
}

export function EventsDashboardView({
  counts,
  recent,
  total,
  sourceFilter,
}: {
  counts: EventCountByName[];
  recent: RecentEvent[];
  total: number;
  sourceFilter?: EventSource;
}) {
  return (
    <>
      {/* Compteur total 24h — cliquable vers le stream non filtré (UX-DASH-008). */}
      <section className="mb-8">
        <Link
          href="/admin/emails/events"
          aria-label={`Total des events sur 24 h : ${total}. Voir le flux complet.`}
          className="block rounded-lg border border-stone-200 bg-white p-6 transition hover:ring-2 hover:ring-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500"
        >
          <p className="text-xs uppercase tracking-wider text-stone-500">Total 24h</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-stone-900">
            {total.toLocaleString('fr-FR')}
          </p>
        </Link>
      </section>

      {/* Top events par (event_name, source) — lignes cliquables (UX-DASH-008). */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-stone-900">Top events (24h)</h2>
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
                    Nombre
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {counts.map((c, i) => (
                  <tr key={`${c.eventName}-${c.source}-${i}`} className="hover:bg-stone-50">
                    <td className="px-3 py-2 font-mono text-xs text-stone-800">
                      <Link
                        href={`/admin/emails/events?source=${c.source}`}
                        aria-label={`Filtrer le flux sur la source ${c.source} (${c.eventName}, ${c.count})`}
                        className="underline underline-offset-2 hover:text-stone-900"
                      >
                        {c.eventName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <SourcePill source={c.source} />
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

      {/* Flux des 100 derniers events + filtres source (UX-DASH-007/009). */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">100 derniers events</h2>
          <nav className="flex items-center gap-2 text-xs" aria-label="Filtrer par source">
            <span className="text-stone-500">Filtrer source :</span>
            <Link
              href="/admin/emails/events"
              aria-current={!sourceFilter ? 'true' : undefined}
              className={`rounded px-2 py-1 ${!sourceFilter ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
            >
              Tous
            </Link>
            {EVENT_SOURCES.map((s) => (
              <Link
                key={s}
                href={`/admin/emails/events?source=${s}`}
                aria-current={sourceFilter === s ? 'true' : undefined}
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
                    Propriétés
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
                      <SourcePill source={r.source} />
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
    </>
  );
}
