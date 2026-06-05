/**
 * Resume bridge for wait_for_event steps (M5.5).
 *
 * When a user_event arrives that matches a run's awaiting_event_name +
 * awaiting_until > now, the run is woken : status = 'running',
 * nextActionAt = now, currentStep advanced past the wait_for_event step.
 *
 * Called from insertUserEvent (M5.2.1) after the event row is committed.
 */
import 'server-only';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailAutomationRun } from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';
import {
  getStepAtPath,
  isValidPath,
  nextPath as computeNextPath,
  type StepPath,
} from './step-handlers/step-path';
import { AutomationStepSchema, type AutomationStep } from './step-types-v2';
import { z } from 'zod';
import { emailAutomation } from '@/lib/db/schema-emails';

const automationStepsSchema = z.array(AutomationStepSchema);

/**
 * Wakes any run in 'waiting_for_event' status whose awaiting_event_name matches
 * `eventName` and whose recipient_email matches `email`.
 *
 * Returns count of runs resumed.
 */
export async function resumeRunsForEvent(
  eventName: string,
  email: string,
  now: Date = new Date(),
): Promise<number> {
  const drizzle = getDb();
  if (!drizzle) return 0;

  const normalized = email.trim().toLowerCase();

  // Find candidates : waiting + matching event + not timed out
  const candidates = await drizzle
    .select()
    .from(emailAutomationRun)
    .where(
      and(
        eq(emailAutomationRun.status, 'waiting_for_event'),
        eq(emailAutomationRun.awaitingEventName, eventName),
        eq(emailAutomationRun.recipientEmail, normalized),
        gt(emailAutomationRun.awaitingUntil, now),
      ),
    )
    .limit(50); // safety cap per event

  if (candidates.length === 0) return 0;

  let resumed = 0;
  for (const run of candidates) {
    try {
      // Compute next path past the wait_for_event step
      const ctx = (run.contextJson as Record<string, unknown> | null) ?? {};
      const ctxPath = ctx._path;
      const currentPath: StepPath = isValidPath(ctxPath) ? ctxPath : [run.currentStep];

      // Load the automation steps
      const [auto] = await drizzle
        .select()
        .from(emailAutomation)
        .where(eq(emailAutomation.id, run.automationId))
        .limit(1);
      if (!auto) continue;

      const parsed = automationStepsSchema.safeParse(auto.steps);
      if (!parsed.success) continue;
      const steps = parsed.data;

      const advanced = computeNextPath(steps, currentPath);
      const newCtx = { ...ctx, _path: advanced };

      await drizzle
        .update(emailAutomationRun)
        .set({
          status: 'running',
          awaitingEventName: null,
          awaitingUntil: null,
          nextActionAt: now,
          currentStep: advanced && typeof advanced[0] === 'number' ? advanced[0] : run.currentStep,
          contextJson: newCtx,
        })
        .where(eq(emailAutomationRun.id, run.id));
      resumed++;
    } catch (err) {
      logger.error('automation.resume.failed', {
        runId: run.id,
        error: String(err),
      });
    }
  }

  if (resumed > 0) {
    logger.info('automation.resume.runs_woken', {
      eventName,
      email: normalized,
      resumed,
    });
  }
  return resumed;
}

/**
 * Marks runs whose awaiting_until has passed according to leur step `onTimeout` :
 *   - `continue` (défaut) → status='running' + next_action_at=now : le runner
 *     les reprend et AVANCE au-delà du step wait_for_event ;
 *   - `abort` → status='cancelled' : le run s'arrête (UX-AUT-008). AUCUN step
 *     suivant n'est exécuté (ex. S3-B : pas de demande d'avis envoyée à tort).
 *
 * Câblé (UX-AUT-008, vague 4) : avant, le sweep forçait TOUJOURS `running`
 * (commentaire « a more nuanced impl would inspect step.onTimeout ») → le choix
 * « Abandonner » de l'UI était une fausse promesse. On inspecte désormais le
 * step réel de chaque run expiré.
 *
 * Stratégie : un sous-step cron dans /api/cron/email-automation appelle ceci
 * AVANT de claimer les batches.
 *
 * @returns total des runs balayés (continue + abort).
 */
export async function sweepWaitForEventTimeouts(now: Date = new Date()): Promise<number> {
  const drizzle = getDb();
  if (!drizzle) return 0;

  // NB : Date JS crue interdite dans un template sql postgres-js (ERR_INVALID_ARG_TYPE
  // à la phase ParameterDescription) → bind ISO + cast ::timestamptz (conventions §8).
  const nowIso = now.toISOString();

  // 1) Récupère les runs expirés (status waiting_for_event + awaiting_until passé).
  const expired = await drizzle
    .select()
    .from(emailAutomationRun)
    .where(
      and(
        eq(emailAutomationRun.status, 'waiting_for_event'),
        sql`${emailAutomationRun.awaitingUntil} IS NOT NULL`,
        sql`${emailAutomationRun.awaitingUntil} <= ${nowIso}::timestamptz`,
      ),
    )
    .limit(200);

  if (expired.length === 0) return 0;

  // 2) Pour chaque run, résout le step wait_for_event courant pour lire onTimeout.
  //    On met en cache les steps d'automation pour éviter N requêtes.
  const autoStepsCache = new Map<string, AutomationStep[] | null>();

  const continueIds: string[] = [];
  const abortIds: string[] = [];

  for (const run of expired) {
    let steps = autoStepsCache.get(run.automationId);
    if (steps === undefined) {
      const [auto] = await drizzle
        .select()
        .from(emailAutomation)
        .where(eq(emailAutomation.id, run.automationId))
        .limit(1);
      const parsed = auto ? automationStepsSchema.safeParse(auto.steps) : null;
      steps = parsed && parsed.success ? parsed.data : null;
      autoStepsCache.set(run.automationId, steps);
    }

    const onTimeout = steps ? resolveOnTimeout(run, steps) : 'continue';
    if (onTimeout === 'abort') abortIds.push(run.id);
    else continueIds.push(run.id);
  }

  // 3a) continue → re-armés en running (le runner avancera au-delà du wait).
  if (continueIds.length > 0) {
    await drizzle.execute(sql`
      UPDATE email_automation_run
      SET status = 'running',
          next_action_at = ${nowIso}::timestamptz,
          awaiting_event_name = NULL,
          awaiting_until = NULL
      WHERE id IN ${inArrayIds(continueIds)};
    `);
  }

  // 3b) abort → cancelled (le run s'arrête, raison consignée pour la timeline).
  if (abortIds.length > 0) {
    await drizzle.execute(sql`
      UPDATE email_automation_run
      SET status = 'cancelled',
          finished_at = ${nowIso}::timestamptz,
          next_action_at = NULL,
          awaiting_event_name = NULL,
          awaiting_until = NULL,
          context_json = jsonb_set(
            COALESCE(context_json, '{}'::jsonb),
            '{_cancelledReason}',
            to_jsonb('wait_for_event_timeout_abort'::text),
            true
          )
      WHERE id IN ${inArrayIds(abortIds)};
    `);
  }

  const swept = continueIds.length + abortIds.length;
  if (swept > 0) {
    logger.info('automation.resume.timeouts_swept', {
      count: swept,
      continued: continueIds.length,
      aborted: abortIds.length,
    });
  }
  return swept;
}

/** Résout l'onTimeout du step wait_for_event courant d'un run expiré. */
function resolveOnTimeout(
  run: { contextJson: unknown; currentStep: number },
  steps: AutomationStep[],
): 'continue' | 'abort' {
  const ctx = (run.contextJson as Record<string, unknown> | null) ?? {};
  const ctxPath = ctx._path;
  const path: StepPath = isValidPath(ctxPath) ? ctxPath : [run.currentStep];
  const step = getStepAtPath(steps, path);
  if (step && step.kind === 'wait_for_event' && step.onTimeout === 'abort') {
    return 'abort';
  }
  return 'continue';
}

/** Construit un fragment `(id1, id2, …)` sûr pour `IN`. */
function inArrayIds(ids: string[]) {
  return sql`(${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )})`;
}
