/**
 * /admin/emails/automation/runs/[id] — Détail d'un run + TIMELINE des steps.
 *
 * UX-AUT-010 : au lieu d'un dump JSON brut, on rend une vraie timeline :
 *  - la liste des steps de l'automation (avec leur libellé FR) ;
 *  - lequel est en cours (currentStep / _path), lesquels sont passés/à venir ;
 *  - les raisons _skippedReason (cooldown/cap), _deferredReason (quiet hours)
 *    + _deferredUntil, _cancelledReason (achat/abort) extraites de contextJson ;
 *  - chaque outbox lié au run.
 * UX-AUT-003 : bouton Relancer sur un run en erreur.
 */
import Link from 'next/link';
import { eq, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { db as getDb } from '@/lib/db/client';
import {
  emailAutomation,
  emailOutbox,
  emailAutomationRun,
} from '@/lib/db/schema-emails';
import { stepLabel } from '@/components/admin/emails/automation/step-defaults';
import { AutomationStepSchema, type AutomationStep } from '@/lib/mail/automation/step-types-v2';
import { z } from 'zod';
import { StatusPill } from '../run-status';
import { RetryRunDetailButton } from '../../AutomationRowActions';

export const dynamic = 'force-dynamic';

const stepsSchema = z.array(AutomationStepSchema);

async function load(id: string) {
  const drizzle = getDb();
  if (!drizzle) return null;
  const [run] = await drizzle
    .select()
    .from(emailAutomationRun)
    .where(eq(emailAutomationRun.id, id))
    .limit(1);
  if (!run) return null;
  const [auto] = await drizzle
    .select()
    .from(emailAutomation)
    .where(eq(emailAutomation.id, run.automationId))
    .limit(1);
  const outboxIds = Array.isArray(run.outboxIds) ? (run.outboxIds as string[]) : [];
  const outboxes =
    outboxIds.length > 0
      ? await drizzle.select().from(emailOutbox).where(inArray(emailOutbox.id, outboxIds))
      : [];
  return { run, auto, outboxes };
}

/** Index top-level du step courant (le 1er segment du path). */
function currentTopIndex(ctx: Record<string, unknown>, fallback: number): number {
  const path = ctx._path;
  if (Array.isArray(path) && typeof path[0] === 'number') return path[0];
  return fallback;
}

export default async function AutomationRunPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin(`/admin/emails/automation/runs/${params.id}`);
  const data = await load(params.id);
  if (!data) notFound();
  const { run, auto, outboxes } = data;

  const ctx = (run.contextJson as Record<string, unknown> | null) ?? {};
  const parsedSteps = auto ? stepsSchema.safeParse(auto.steps) : null;
  const steps: AutomationStep[] = parsedSteps && parsedSteps.success ? parsedSteps.data : [];
  const curIdx = currentTopIndex(ctx, run.currentStep);

  const skippedReason = typeof ctx._skippedReason === 'string' ? ctx._skippedReason : null;
  const skippedStep = ctx._skippedStep != null ? String(ctx._skippedStep) : null;
  const deferredReason = typeof ctx._deferredReason === 'string' ? ctx._deferredReason : null;
  const deferredUntil = typeof ctx._deferredUntil === 'string' ? ctx._deferredUntil : null;
  const cancelledReason = typeof ctx._cancelledReason === 'string' ? ctx._cancelledReason : null;

  const isTerminal = run.status === 'completed' || run.status === 'cancelled';

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6">
        <nav aria-label="Fil d'Ariane" className="text-sm text-stone-500">
          <Link href="/admin/emails/automation" className="underline">
            Automations
          </Link>
          {' / '}
          <Link href="/admin/emails/automation/runs" className="underline">
            Runs
          </Link>
          {' / '}
          <span className="text-stone-700">{run.id.slice(0, 8)}…</span>
        </nav>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
          Run {run.id.slice(0, 12)}…
        </h1>
        <p className="text-sm text-stone-500">
          Automation :{' '}
          {auto ? (
            <Link href={`/admin/emails/automation/${auto.id}/edit`} className="underline">
              {auto.name}
            </Link>
          ) : (
            '—'
          )}
        </p>
      </header>

      <section className="space-y-3 rounded border border-stone-200 bg-white p-5">
        <dl className="space-y-2 text-sm">
          <Row label="Statut" value={<StatusPill status={run.status} />} />
          <Row
            label="Destinataire"
            value={<code className="font-mono text-xs">{run.recipientEmail}</code>}
          />
          <Row
            label="Déclenché"
            value={new Date(run.triggeredAt).toLocaleString('fr-FR', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          />
          {run.nextActionAt && (
            <Row
              label="Prochaine action"
              value={new Date(run.nextActionAt).toLocaleString('fr-FR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            />
          )}
          {run.awaitingEventName && (
            <Row
              label="En attente"
              value={`événement « ${run.awaitingEventName} »${
                run.awaitingUntil
                  ? ` jusqu'au ${new Date(run.awaitingUntil).toLocaleString('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}`
                  : ''
              }`}
            />
          )}
          {run.finishedAt && (
            <Row
              label="Terminé"
              value={new Date(run.finishedAt).toLocaleString('fr-FR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            />
          )}
          {run.erroredReason && (
            <Row label="Erreur" value={<span className="text-rose-700">{run.erroredReason}</span>} />
          )}
          {cancelledReason && (
            <Row
              label="Annulé"
              value={
                <span className="text-stone-700">
                  {cancelledReason === 'purchase_completed'
                    ? 'Achat finalisé (relance superflue)'
                    : cancelledReason === 'wait_for_event_timeout_abort'
                    ? 'Timeout atteint (abandon configuré)'
                    : cancelledReason}
                </span>
              }
            />
          )}
        </dl>

        {run.status === 'errored' && (
          <div className="mt-3 border-t border-stone-100 pt-3">
            <RetryRunDetailButton id={run.id} />
          </div>
        )}
      </section>

      {/* Encarts différé / sauté */}
      {(deferredReason || skippedReason) && (
        <div className="mt-6 space-y-2">
          {deferredReason && (
            <div role="status" className="rounded border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              <strong>Envoi différé</strong> — {humanizeDefer(deferredReason)}
              {deferredUntil && (
                <>
                  {' '}
                  jusqu&apos;au{' '}
                  {new Date(deferredUntil).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </>
              )}
              .
            </div>
          )}
          {skippedReason && (
            <div role="status" className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Envoi sauté</strong> (step {skippedStep ?? '?'}) — {humanizeSkip(skippedReason)}.
            </div>
          )}
        </div>
      )}

      {/* TIMELINE des steps */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-stone-700">Déroulé des étapes</h2>
        {steps.length === 0 ? (
          <p className="text-sm text-stone-500">Aucune étape lisible pour cette automation.</p>
        ) : (
          <ol className="space-y-2" data-testid="run-timeline">
            {steps.map((step, i) => {
              const state: 'done' | 'current' | 'upcoming' = isTerminal
                ? 'done'
                : i < curIdx
                ? 'done'
                : i === curIdx
                ? 'current'
                : 'upcoming';
              return (
                <li
                  key={i}
                  data-testid={`timeline-step-${i}`}
                  data-state={state}
                  className={`flex items-start gap-3 rounded border px-4 py-3 ${
                    state === 'current'
                      ? 'border-amber-300 bg-amber-50'
                      : state === 'done'
                      ? 'border-stone-200 bg-stone-50'
                      : 'border-dashed border-stone-200 bg-white'
                  }`}
                >
                  <span className="mt-0.5 text-xs text-stone-400">#{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm text-stone-800">{stepLabel(step)}</p>
                    <p className="text-xs text-stone-500">{timelineLabel(state)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-stone-700">
          Emails envoyés ({outboxes.length})
        </h2>
        {outboxes.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun email envoyé pour ce run.</p>
        ) : (
          <ul className="space-y-2">
            {outboxes.map((o) => (
              <li key={o.id} className="rounded border border-stone-200 bg-white p-3">
                <Link
                  href={`/admin/emails/outbox/${o.id}`}
                  className="font-mono text-xs text-stone-700 hover:underline"
                >
                  {o.id}
                </Link>
                <span className="ml-3 text-xs text-stone-500">{o.status}</span>
                <span className="ml-3 text-xs text-stone-500">→ {o.toEmail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Contexte brut repliable (diagnostic avancé). */}
      <details className="mt-6 rounded border border-stone-200 bg-stone-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-stone-700">
          Contexte JSON (diagnostic)
        </summary>
        <pre className="mt-3 overflow-auto rounded bg-stone-900 p-3 text-xs text-stone-100">
          {JSON.stringify(run.contextJson, null, 2)}
        </pre>
      </details>
    </AdminShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-36 shrink-0 text-stone-500">{label}</dt>
      <dd className="text-stone-800">{value}</dd>
    </div>
  );
}

function timelineLabel(state: 'done' | 'current' | 'upcoming'): string {
  if (state === 'current') return 'En cours';
  if (state === 'done') return 'Fait';
  return 'À venir';
}

function humanizeDefer(reason: string): string {
  if (reason.startsWith('quiet_hours')) return 'heures calmes (quiet hours)';
  return reason;
}

function humanizeSkip(reason: string): string {
  if (reason.startsWith('daily_cap')) return `plafond quotidien atteint (${reason})`;
  if (reason.startsWith('cooldown')) return `cooldown actif (${reason})`;
  return reason;
}
