/**
 * CHA-225 — Vue rapide `/admin/chat/leads`.
 *
 * Complète `/admin/leads` (qui fusionne ecommerce + chat) en restant
 * 100 % chat : on voit le `triggerReason`, l'`outcome`, la session
 * d'origine et la page de capture sans devoir ouvrir le détail.
 */
import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { ConversationQuickView } from '@/components/admin/chat/ConversationQuickView';
import { adminQueries } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';
import type { ChatLeadRow } from '@/lib/chat/db/schema';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: { outcome?: string; trigger?: string };
}

const OUTCOMES: ReadonlyArray<ChatLeadRow['outcome']> = [
  'pending',
  'reached',
  'no-answer',
  'converted',
  'discarded',
];

const TRIGGERS: ReadonlyArray<ChatLeadRow['triggerReason']> = [
  'explicit-request',
  'out-of-knowledge',
  'objection-repeat',
  'long-no-progress',
  'frustration',
  'after-hours',
  'b2b',
  'purchase-intent',
  'inline-contact',
  'manual',
];

export default async function ChatLeadsPage({ searchParams }: PageProps) {
  const session = await requireAdmin('/admin/chat/leads');
  const enabled = isChatEnabled();

  const outcome = (searchParams?.outcome ?? '').trim();
  const trigger = (searchParams?.trigger ?? '').trim();

  let rows: ChatLeadRow[] = [];
  let queryError: string | null = null;
  if (enabled) {
    try {
      rows = await adminQueries.listChatLeads({
        outcome: OUTCOMES.includes(outcome as ChatLeadRow['outcome'])
          ? (outcome as ChatLeadRow['outcome'])
          : undefined,
        triggerReason: TRIGGERS.includes(trigger as ChatLeadRow['triggerReason'])
          ? (trigger as ChatLeadRow['triggerReason'])
          : undefined,
        limit: 200,
      });
    } catch (err) {
      queryError = (err as Error).message;
    }
  }

  const counts = {
    total: rows.length,
    pending: rows.filter((r) => r.outcome === 'pending').length,
    reached: rows.filter((r) => r.outcome === 'reached').length,
    converted: rows.filter((r) => r.outcome === 'converted').length,
    discarded: rows.filter((r) => r.outcome === 'discarded').length,
  };

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="leads" />
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads chat</h1>
          <p className="mt-1 text-sm text-stone-600">
            Capture in-chat (prénom + téléphone). Vue rapide ; pour la fusion
            avec les leads ecommerce, voir{' '}
            <Link href="/admin/leads" className="underline-offset-2 hover:underline">
              /admin/leads
            </Link>
            .
          </p>
        </div>
      </header>

      <section className="mb-4 grid gap-2 sm:grid-cols-5" aria-label="Résumé outcomes">
        <Counter label="Total" value={counts.total} />
        <Counter label="Pending" value={counts.pending} />
        <Counter label="Reached" value={counts.reached} accent="amber" />
        <Counter label="Converted" value={counts.converted} accent="emerald" />
        <Counter label="Discarded" value={counts.discarded} accent="rose" />
      </section>

      <form className="mb-4 flex flex-wrap gap-2 text-sm" method="get">
        <select
          name="outcome"
          defaultValue={outcome}
          className="rounded-md border border-stone-300 px-2 py-1.5"
        >
          <option value="">Tous outcomes</option>
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          name="trigger"
          defaultValue={trigger}
          className="rounded-md border border-stone-300 px-2 py-1.5"
        >
          <option value="">Tous triggers</option>
          {TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-stone-900 px-3 py-1.5 text-white"
        >
          Filtrer
        </button>
        <Link
          href="/admin/chat/leads"
          className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-100"
        >
          Réinitialiser
        </Link>
      </form>

      {queryError && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {queryError}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Prénom</th>
              <th className="px-3 py-2">Téléphone</th>
              <th className="px-3 py-2">Trigger</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">Page</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Créé</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-stone-500">
                  Aucun lead chat ne correspond aux filtres.
                </td>
              </tr>
            ) : (
              rows.map((l) => (
                <tr
                  key={l.id}
                  className={
                    l.outcome === 'converted'
                      ? 'bg-emerald-50/60 hover:bg-emerald-50'
                      : 'hover:bg-stone-50'
                  }
                >
                  <td className="px-3 py-2 font-medium text-stone-900">{l.firstName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.phoneE164}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
                      {l.triggerReason}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <OutcomeBadge outcome={l.outcome} />
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-600">{l.page ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/admin/chat/conversations/${l.sessionId}`}
                      className="text-stone-700 underline-offset-2 hover:underline"
                    >
                      {l.sessionId.slice(0, 12)}…
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500">
                    {l.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      {/* CHA-229 — Fenêtre rapide pour consulter la
                          conversation rattachée au lead, sans quitter
                          la liste. */}
                      <ConversationQuickView
                        sessionId={l.sessionId}
                        triggerLabel="Voir conversation"
                        subtitle={`${l.firstName} · ${l.phoneE164}`}
                      />
                      <Link
                        href={`/admin/leads/${l.id}`}
                        className="text-xs text-stone-700 underline-offset-2 hover:underline"
                      >
                        Détail
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Counter({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'emerald' | 'rose' | 'amber';
}) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'rose'
        ? 'text-rose-700'
        : accent === 'amber'
          ? 'text-amber-700'
          : 'text-stone-900';
  return (
    <div className="rounded-md border border-stone-200 bg-white px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${accentClass}`}>{value}</p>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: ChatLeadRow['outcome'] }) {
  const styles: Record<ChatLeadRow['outcome'], string> = {
    pending: 'bg-stone-100 text-stone-700',
    reached: 'bg-amber-100 text-amber-800',
    'no-answer': 'bg-amber-50 text-amber-700',
    converted: 'bg-emerald-100 text-emerald-800',
    discarded: 'bg-rose-100 text-rose-700',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[outcome]}`}
    >
      {outcome === 'converted' ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
      ) : null}
      {outcome}
    </span>
  );
}
