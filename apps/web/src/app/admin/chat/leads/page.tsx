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
import { LeadOutcomeSelect } from '@/components/admin/chat/LeadOutcomeSelect';
import { SourceBadge } from '@/components/admin/chat/SourceBadge';
import { adminQueries } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import {
  HOT_TRIGGERS,
  formatLeadAge,
  isHotPendingOverdue,
} from '@/lib/chat/services/lead-sla';
import { requireAdmin } from '@/lib/auth/require-admin';
import type { ChatLeadRow } from '@/lib/chat/db/schema';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: {
    outcome?: string;
    trigger?: string;
    hot?: string;
    /** CHA-LEAD-V2 — Si =1, inclut les leads wizard (debug). */
    includeWizard?: string;
  };
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
  const hotOnly = searchParams?.hot === '1';
  // CHA-LEAD-V2 — Toggle pour inclure les leads wizard (vue debug).
  const includeWizard = searchParams?.includeWizard === '1';

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
        // CHA-LEAD-V2 — undefined = filtre par défaut (chat_widget + inline).
        // Quand includeWizard=1, on passe explicitement toutes les sources.
        sources: includeWizard
          ? ['chat_widget', 'inline', 'wizard_kit', 'wizard_commander', 'newsletter', 'admin']
          : undefined,
        limit: 200,
      });
    } catch (err) {
      queryError = (err as Error).message;
    }
  }

  // CHAT-066 — Filtre "Hot only" : ne garder que les triggers à forte
  // intention (purchase-intent / explicit-request / inline-contact) pour
  // que Care voie d'abord ce qui rapporte. Appliqué côté Node après le
  // fetch pour éviter d'ajouter un IN multi-valeurs côté SQL.
  if (hotOnly) {
    rows = rows.filter((r) => HOT_TRIGGERS.has(r.triggerReason));
  }

  // Une seule référence "now" partagée par toutes les lignes pour que
  // l'affichage d'âge et le test SLA restent cohérents intra-render.
  const now = new Date();
  const overdueCount = rows.filter((r) => isHotPendingOverdue(r, now)).length;

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
        <div className="flex flex-wrap gap-2">
          {/* CHAT-067 — Prévisualiser le digest hebdo avant l'envoi du lundi. */}
          <a
            href="/api/admin/chat/digest/preview"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
          >
            Aperçu digest hebdo
          </a>
          {/* CHAT-066 — Export CSV avec les filtres courants pour relances CRM. */}
          <a
            href={buildExportHref(outcome, trigger)}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
            download
          >
            ⬇ Exporter CSV
          </a>
        </div>
      </header>

      <section className="mb-4 grid gap-2 sm:grid-cols-6" aria-label="Résumé outcomes">
        <Counter label="Total" value={counts.total} />
        <Counter label="Pending" value={counts.pending} />
        <Counter label="Reached" value={counts.reached} accent="amber" />
        <Counter label="Converted" value={counts.converted} accent="emerald" />
        <Counter label="Discarded" value={counts.discarded} accent="rose" />
        {/* CHAT-066 — Hot pending dépassant le SLA Care (4h). Voyant rouge
            si > 0 pour appeler le tri "Hot only" + traitement immédiat. */}
        <Counter
          label="SLA dépassé"
          value={overdueCount}
          accent={overdueCount > 0 ? 'rose' : undefined}
        />
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
        <label className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-stone-700">
          <input
            type="checkbox"
            name="hot"
            value="1"
            defaultChecked={hotOnly}
            className="h-4 w-4"
          />
          Hot only
        </label>
        <label
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-800"
          title="Inclure les leads source=wizard_* (debug — pour analyser la pollution)"
        >
          <input
            type="checkbox"
            name="includeWizard"
            value="1"
            defaultChecked={includeWizard}
            className="h-4 w-4"
          />
          Inclure wizard (debug)
        </label>
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
              <th className="px-3 py-2" title="Temps écoulé depuis la capture du lead">Attente</th>
              <th className="px-3 py-2">Page</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Créé</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-stone-500">
                  Aucun lead chat ne correspond aux filtres.
                </td>
              </tr>
            ) : (
              rows.map((l) => {
                const overdue = isHotPendingOverdue(l, now);
                // Priorité visuelle : overdue (rouge) > converted (vert) >
                // base. On ne mélange pas pour éviter une ligne ambiguë.
                const rowClass = overdue
                  ? 'bg-rose-50 hover:bg-rose-100'
                  : l.outcome === 'converted'
                    ? 'bg-emerald-50/60 hover:bg-emerald-50'
                    : 'hover:bg-stone-50';
                return (
                <tr key={l.id} className={rowClass}>
                  <td className="px-3 py-2 font-medium text-stone-900">{l.firstName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.phoneE164}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex w-fit rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
                        {l.triggerReason}
                      </span>
                      {/* CHA-LEAD-V2 — Badge source : visible toujours pour traçabilité */}
                      <SourceBadge source={l.source} withTooltip />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <OutcomeBadge outcome={l.outcome} />
                      {/* CHAT-066 — Mise à jour inline (status change). */}
                      <LeadOutcomeSelect leadId={l.id} initialOutcome={l.outcome} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    <span
                      className={
                        overdue
                          ? 'rounded-full bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-800'
                          : 'text-stone-600'
                      }
                      title={
                        overdue
                          ? 'Hot pending dépassant le SLA Care (4h)'
                          : `Capturé le ${l.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`
                      }
                    >
                      {formatLeadAge(l.createdAt, now)}
                    </span>
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function buildExportHref(outcome: string, trigger: string): string {
  const params = new URLSearchParams({ format: 'csv' });
  if (outcome) params.set('outcome', outcome);
  if (trigger) params.set('trigger', trigger);
  return `/api/admin/chat/export/leads?${params.toString()}`;
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
