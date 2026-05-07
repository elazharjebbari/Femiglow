/**
 * CHA-121 — Page Audit : événements récents (errors, rate_limit_hit,
 * conversion_attributed, language_switch, etc.) + lien vers la
 * conversation source. Filtrage par type via query string `?type=...`.
 *
 * Sert d'outil d'investigation rapide pour incidents (ex. pic de
 * `error` après bascule de provider).
 */
import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { adminQueries } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

const TYPE_FILTERS = [
  'all',
  'error',
  'rate_limit_hit',
  'conversion_attributed',
  'language_switch',
  'feedback_negative',
  'lead_email_captured',
] as const;

type Filter = (typeof TYPE_FILTERS)[number];

export default async function ChatAuditPage({
  searchParams,
}: {
  searchParams?: { type?: string };
}) {
  const session = await requireAdmin('/admin/chat/audit');
  if (!isChatEnabled()) {
    return (
      <AdminShell adminEmail={session.email} active="chat">
        <ChatAdminNav active="audit" />
        <p className="text-sm text-stone-500">Chat désactivé.</p>
      </AdminShell>
    );
  }

  const rawFilter = (searchParams?.type ?? 'all') as Filter;
  const filter: Filter = TYPE_FILTERS.includes(rawFilter) ? rawFilter : 'all';
  const events = await adminQueries.recentEvents(200).catch(() => []);
  const filtered =
    filter === 'all' ? events : events.filter((e) => e.type === filter);

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="audit" />
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Audit</h1>
        <p className="text-sm text-stone-600">
          200 derniers événements `chat_conversation_event` — erreurs,
          quotas, conversions, switches de langue, feedbacks négatifs.
        </p>
      </header>

      <nav className="mb-4 flex flex-wrap gap-2 text-xs">
        {TYPE_FILTERS.map((t) => {
          const active = t === filter;
          return (
            <Link
              key={t}
              href={t === 'all' ? '/admin/chat/audit' : `/admin/chat/audit?type=${t}`}
              className={`rounded-full px-3 py-1 ${
                active
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {t}
            </Link>
          );
        })}
      </nav>

      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2">Quand</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Payload</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-stone-500">
                  Aucun événement.
                </td>
              </tr>
            )}
            {filtered.map((ev) => (
              <tr key={ev.id} className="border-t border-stone-100">
                <td className="px-3 py-2 align-top text-xs tabular-nums text-stone-500">
                  {ev.occurredAt.toISOString().slice(0, 19).replace('T', ' ')}
                </td>
                <td className="px-3 py-2 align-top">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      ev.type === 'error' || ev.type === 'rate_limit_hit'
                        ? 'bg-rose-100 text-rose-700'
                        : ev.type === 'conversion_attributed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {ev.type}
                  </span>
                </td>
                <td className="px-3 py-2 align-top">
                  <Link
                    href={`/admin/chat/conversations/${ev.sessionId}`}
                    className="font-mono text-xs text-stone-700 underline-offset-2 hover:underline"
                  >
                    {ev.sessionId.slice(0, 12)}…
                  </Link>
                </td>
                <td className="px-3 py-2 align-top">
                  {ev.payload ? (
                    <pre className="max-w-md overflow-x-auto rounded bg-stone-50 px-2 py-1 text-[11px]">
{JSON.stringify(ev.payload, null, 0)}
                    </pre>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
