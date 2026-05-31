/**
 * CHA-121 — Page Audit : événements récents (errors, rate_limit_hit,
 * conversion_attributed, language_switch, etc.) + lien vers la
 * conversation source. Filtrage par type via query string `?type=...`.
 *
 * Sert d'outil d'investigation rapide pour incidents (ex. pic de
 * `error` après bascule de provider).
 */
import { sql } from 'drizzle-orm';
import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { CleanupGhostsButton } from '@/components/admin/chat/CleanupGhostsButton';
import { adminQueries } from '@/lib/chat/admin/queries';
import { requireChatDb } from '@/lib/chat/db/client';
import { chatLead, chatSession } from '@/lib/chat/db/schema';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

interface PollutionSnapshot {
  sessionByKind: Array<{ kind: string; n: number }>;
  leadBySource: Array<{ source: string; n: number }>;
}

async function loadPollutionSnapshot(): Promise<PollutionSnapshot> {
  const db = requireChatDb();
  const kinds = await db
    .select({ kind: chatSession.kind, n: sql<number>`COUNT(*)` })
    .from(chatSession)
    .groupBy(chatSession.kind);
  const sources = await db
    .select({ source: chatLead.source, n: sql<number>`COUNT(*)` })
    .from(chatLead)
    .groupBy(chatLead.source);
  return {
    sessionByKind: kinds.map((r) => ({ kind: r.kind, n: Number(r.n) })),
    leadBySource: sources.map((r) => ({ source: r.source, n: Number(r.n) })),
  };
}

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

  // CHA-LEAD-V2 — Snapshot pollution pour la section dédiée.
  const pollution = await loadPollutionSnapshot().catch(() => ({
    sessionByKind: [],
    leadBySource: [],
  }));
  const totalSessions = pollution.sessionByKind.reduce((s, r) => s + r.n, 0);
  const wizardPivot =
    pollution.sessionByKind.find((r) => r.kind === 'wizard_pivot')?.n ?? 0;
  const pollutionPct =
    totalSessions > 0 ? Math.round((wizardPivot / totalSessions) * 100) : 0;

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

      {/* CHA-LEAD-V2 — Section "Santé pollution chat_session" */}
      <section className="mb-6 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Santé pollution chat_session
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Vue synthétique : répartition par <code>kind</code> et{' '}
          <code>source</code>, signal de pollution wizard.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
              Sessions par kind
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {pollution.sessionByKind.map((r) => (
                  <tr key={r.kind} className="border-b border-stone-100 last:border-0">
                    <td className="py-1 font-mono text-xs">{r.kind}</td>
                    <td className="py-1 text-right tabular-nums">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
              Leads par source
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {pollution.leadBySource.map((r) => (
                  <tr key={r.source} className="border-b border-stone-100 last:border-0">
                    <td className="py-1 font-mono text-xs">{r.source}</td>
                    <td className="py-1 text-right tabular-nums">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-sm text-stone-700">
          Pollution rate :{' '}
          <strong
            className={
              pollutionPct > 50 ? 'text-rose-700' : pollutionPct > 25 ? 'text-amber-700' : 'text-emerald-700'
            }
          >
            {pollutionPct}%
          </strong>{' '}
          (<span className="tabular-nums">{wizardPivot}</span> wizard_pivot /{' '}
          <span className="tabular-nums">{totalSessions}</span> total)
        </p>

        <CleanupGhostsButton />
      </section>

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
