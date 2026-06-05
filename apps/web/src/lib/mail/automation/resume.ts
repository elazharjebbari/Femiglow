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
  isValidPath,
  nextPath as computeNextPath,
  type StepPath,
} from './step-handlers/step-path';
import { AutomationStepSchema } from './step-types-v2';
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
 * Marks runs whose awaiting_until has passed as either completed (onTimeout=continue)
 * or errored (onTimeout=abort). Called by the runner cron when picking up runs.
 *
 * Simpler V1 : we leverage the existing 'waiting_for_event' rows whose
 * next_action_at <= now() (set to awaiting_until). The runner picks them up
 * via UPDATE ... WHERE status='running'. But waiting_for_event isn't 'running',
 * so we need a separate sweep.
 *
 * Strategy : a cron sub-step in /api/cron/email-automation calls this BEFORE
 * picking up batches.
 */
export async function sweepWaitForEventTimeouts(now: Date = new Date()): Promise<number> {
  const drizzle = getDb();
  if (!drizzle) return 0;

  // For timed-out runs : set status='running' + nextActionAt=now so the runner
  // picks them up and advances past the wait_for_event step (default onTimeout=continue).
  // Note : a more nuanced impl would inspect step.onTimeout to either continue or abort.
  // NB : Date JS crue interdite dans un template sql postgres-js (ERR_INVALID_ARG_TYPE
  // à la phase ParameterDescription) → bind ISO + cast ::timestamptz (conventions §8).
  const nowIso = now.toISOString();
  const result = await drizzle.execute(sql`
    UPDATE email_automation_run
    SET status = 'running',
        next_action_at = ${nowIso}::timestamptz,
        awaiting_event_name = NULL,
        awaiting_until = NULL
    WHERE status = 'waiting_for_event'
      AND awaiting_until IS NOT NULL
      AND awaiting_until <= ${nowIso}::timestamptz
    RETURNING id;
  `);
  // postgres-js renvoie le RowList (tableau) directement ; neon-http renvoie
  // { rows }. Le shape `.rows` seul rendait le compte TOUJOURS 0 en prod.
  const rows = Array.isArray(result)
    ? (result as unknown as { id: string }[])
    : ((result as unknown as { rows?: { id: string }[] }).rows ?? []);
  if (rows.length > 0) {
    logger.info('automation.resume.timeouts_swept', { count: rows.length });
  }
  return rows.length;
}
