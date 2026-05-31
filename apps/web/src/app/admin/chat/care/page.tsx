/**
 * CHAT-066 — Console Care (Karim).
 *
 * Vue consolidée des deux signaux critiques pour l'équipe Care :
 *
 *  1. Hot leads pending + SLA dépassé (lien direct vers /admin/chat/leads
 *     filtré). On évite de re-faire la table — c'est `/admin/chat/leads`
 *     qui détient la vérité, ici on agrège pour décider "j'attaque par
 *     quoi ce matin".
 *  2. Spikes de frustration sur 7 jours (events `frustration_detected`)
 *     avec lien direct vers la conversation. RGPD : on n'affiche que
 *     `sessionId` + `occurredAt`, pas de contenu de message.
 *
 * Bonus : lien vers l'aperçu du digest hebdo + bouton export CSV qui
 * existent déjà sur `/admin/chat/leads`.
 */
import Link from 'next/link';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { adminQueries } from '@/lib/chat/admin/queries';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { summarizeCare } from '@/lib/chat/services/care-overview';
import { HOT_PENDING_SLA_HOURS } from '@/lib/chat/services/lead-sla';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function ChatCarePage() {
  const session = await requireAdmin('/admin/chat/care');
  const enabled = isChatEnabled();

  let summary: ReturnType<typeof summarizeCare> | null = null;
  let frustrationEvents: Array<{ sessionId: string; occurredAt: Date }> = [];
  let queryError: string | null = null;
  const now = new Date();

  if (enabled) {
    try {
      const data = await adminQueries.careOverview({ limit: 200 });
      summary = summarizeCare({
        pendingLeads: data.pendingLeads,
        frustrationEvents: data.frustrationEvents,
        now,
      });
      frustrationEvents = data.frustrationEvents;
    } catch (err) {
      queryError = (err as Error).message;
    }
  }

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="care" />
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Care — vue Karim</h1>
          <p className="mt-1 text-sm text-stone-600">
            Hot leads en attente + alertes frustration sur 7 jours. SLA cible{' '}
            <strong>{HOT_PENDING_SLA_HOURS}h</strong> sur les hot pending.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/chat/leads?hot=1"
            className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800"
          >
            Ouvrir Hot leads →
          </Link>
          <a
            href="/api/admin/chat/digest/preview"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
          >
            Aperçu digest hebdo
          </a>
        </div>
      </header>

      {!enabled && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Le module chat est désactivé (CHAT_ENABLED=false).
        </div>
      )}
      {queryError && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {queryError}
        </div>
      )}

      {summary && (
        <>
          <section className="mb-6 grid gap-2 sm:grid-cols-3" aria-label="Hot leads">
            <Counter
              label="Hot pending"
              value={summary.hotPending}
              hint="Trigger purchase / explicit / inline-contact"
            />
            <Counter
              label="SLA dépassé"
              value={summary.hotOverdue}
              accent={summary.hotOverdue > 0 ? 'rose' : undefined}
              hint={`Hot pending depuis ≥ ${HOT_PENDING_SLA_HOURS}h`}
            />
            <Counter
              label="% Hot overdue"
              value={`${Math.round(summary.hotOverdueRatio * 100)} %`}
              accent={summary.hotOverdueRatio >= 0.3 ? 'rose' : undefined}
              hint="Part des hot pending en retard"
            />
          </section>

          <section className="mb-6 grid gap-2 sm:grid-cols-3" aria-label="Frustration">
            <Counter
              label="Frustration 24h"
              value={summary.frustration24h}
              accent={summary.frustration24h > 0 ? 'amber' : undefined}
              hint="Spikes détectés ces 24 dernières heures"
            />
            <Counter
              label="Frustration 7j"
              value={summary.frustration7d}
              hint="Sur la dernière semaine"
            />
            <Counter
              label="Sessions concernées"
              value={summary.frustrationSessions7d}
              hint="Sessions distinctes (7j)"
            />
          </section>

          <FrustrationList events={frustrationEvents.slice(0, 30)} />
        </>
      )}
    </AdminShell>
  );
}

function FrustrationList({
  events,
}: {
  events: ReadonlyArray<{ sessionId: string; occurredAt: Date }>;
}) {
  if (events.length === 0) {
    return (
      <section className="rounded-md border border-stone-200 bg-white px-4 py-6 text-sm text-stone-600">
        <h2 className="mb-2 text-base font-semibold text-stone-900">
          Spikes de frustration récents
        </h2>
        <p>Aucun spike détecté sur les 7 derniers jours — silence radio côté Care 🎉.</p>
      </section>
    );
  }
  return (
    <section aria-label="Spikes frustration récents">
      <h2 className="mb-2 text-base font-semibold text-stone-900">
        Spikes de frustration récents
      </h2>
      <p className="mb-2 text-xs text-stone-500">
        Top {events.length} événements (les plus récents en premier). Cliquer ouvre la
        conversation.
      </p>
      <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Quand</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {events.map((ev, i) => (
              <tr key={`${ev.sessionId}-${i}`}>
                <td className="px-3 py-2 text-stone-700">
                  {ev.occurredAt.toISOString().replace('T', ' ').slice(0, 16)}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-stone-600">
                  {ev.sessionId}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/chat/conversations/${ev.sessionId}`}
                    className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
                  >
                    Voir conversation
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Counter({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number | string;
  accent?: 'emerald' | 'rose' | 'amber';
  hint?: string;
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
    <div className="rounded-md border border-stone-200 bg-white px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accentClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
