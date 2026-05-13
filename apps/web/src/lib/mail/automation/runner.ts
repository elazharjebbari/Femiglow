/**
 * Automation runner — picks up due `email_automation_run` rows and
 * advances them one step at a time.
 *
 * Called by /api/cron/email-automation every 60s.
 *
 *   1. SELECT runs with status='running' AND nextActionAt <= now()
 *   2. For each run :
 *        - load the parent automation's steps
 *        - read step at currentStep
 *        - if 'send'   → sendTransactional + update outboxIds + increment step
 *        - if 'wait'   → nextActionAt = now + durationMs, increment step
 *        - if past end → status='completed', finishedAt=now
 *   3. Return summary
 *
 * Idempotent : `FOR UPDATE SKIP LOCKED` so concurrent runners don't collide.
 * Errors per-run are caught and demote that run to status='errored' (the
 * batch keeps going).
 */
import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { rowsOf } from '@/lib/db/exec';
import {
  emailAutomation,
  emailAutomationRun,
  type EmailAutomationRunRow,
} from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';
import { sendTransactional } from '@/lib/mail/send';
import { isKnownTemplate, type TemplateSlug } from '@/lib/mail/catalog';
import {
  automationStepsSchema,
  type AutomationSteps,
  type AutomationStep,
  type AutomationContext,
} from './types';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

const BATCH_SIZE = 50;

export type RunnerResult = {
  picked: number;
  advanced: number;
  completed: number;
  errored: number;
  durationMs: number;
};

export async function tickAutomation(now: Date = new Date()): Promise<RunnerResult> {
  const drizzle = requireDb();
  const startedAt = Date.now();

  // Claim a batch — set nextActionAt to NULL to mark 'in-flight' so
  // re-entries of the cron don't double-pick.
  const result = (await drizzle.execute(sql`
    UPDATE email_automation_run o
    SET next_action_at = NULL
    FROM (
      SELECT id FROM email_automation_run
      WHERE status = 'running'
        AND next_action_at IS NOT NULL
        AND next_action_at <= now()
      ORDER BY next_action_at ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    ) AS picked
    WHERE o.id = picked.id
    RETURNING o.*;
  `)) as unknown as { rows: EmailAutomationRunRow[] } | EmailAutomationRunRow[];
  const picked = rowsOfRun(result);

  let advanced = 0;
  let completed = 0;
  let errored = 0;

  for (const run of picked) {
    try {
      const finished = await processRun(run, now);
      if (finished) {
        completed++;
      } else {
        advanced++;
      }
    } catch (err) {
      errored++;
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('automation.run_errored', { runId: run.id, error: msg });
      await drizzle
        .update(emailAutomationRun)
        .set({ status: 'errored', finishedAt: new Date(), nextActionAt: null })
        .where(eq(emailAutomationRun.id, run.id));
    }
  }

  return {
    picked: picked.length,
    advanced,
    completed,
    errored,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Process a single run : execute the current step, schedule the next.
 * Returns true if the run is completed (no more steps).
 */
async function processRun(run: EmailAutomationRunRow, now: Date): Promise<boolean> {
  const drizzle = requireDb();

  // Load parent automation
  const [auto] = await drizzle
    .select()
    .from(emailAutomation)
    .where(eq(emailAutomation.id, run.automationId))
    .limit(1);
  if (!auto) throw new Error(`Automation ${run.automationId} introuvable`);

  if (!auto.active) {
    // Parent was disabled — cancel the run.
    await drizzle
      .update(emailAutomationRun)
      .set({ status: 'cancelled', finishedAt: now, nextActionAt: null })
      .where(eq(emailAutomationRun.id, run.id));
    return true;
  }

  const steps = parseSteps(auto.steps);
  const idx = run.currentStep;

  if (idx >= steps.length) {
    // Already done
    await drizzle
      .update(emailAutomationRun)
      .set({ status: 'completed', finishedAt: now, nextActionAt: null })
      .where(eq(emailAutomationRun.id, run.id));
    return true;
  }

  const step = steps[idx]!;
  const ctx = (run.contextJson as AutomationContext) ?? { recipientEmail: run.recipientEmail };

  if (step.kind === 'send') {
    if (!isKnownTemplate(step.template)) {
      throw new Error(`Template inconnu : ${step.template}`);
    }
    const payload: Record<string, unknown> = {};
    for (const k of step.payloadKeys) {
      payload[k] = ctx[k];
    }
    const idempotencyKey = `automation:${run.id}:step${idx}`;
    const result = await sendTransactional({
      template: step.template as TemplateSlug,
      to: { email: run.recipientEmail },
      payload: payload as never, // typed by catalog at runtime
      idempotencyKey,
      source: `automation.${auto.slug}.step${idx}`,
    });

    const outboxIds = Array.isArray(run.outboxIds) ? [...(run.outboxIds as string[])] : [];
    if (result.status === 'queued' || result.status === 'duplicate') {
      outboxIds.push(result.outboxId);
    }

    const nextIdx = idx + 1;
    if (nextIdx >= steps.length) {
      await drizzle
        .update(emailAutomationRun)
        .set({
          currentStep: nextIdx,
          status: 'completed',
          finishedAt: now,
          nextActionAt: null,
          outboxIds,
        })
        .where(eq(emailAutomationRun.id, run.id));
      return true;
    }
    await drizzle
      .update(emailAutomationRun)
      .set({
        currentStep: nextIdx,
        nextActionAt: now,
        outboxIds,
      })
      .where(eq(emailAutomationRun.id, run.id));
    return false;
  }

  if (step.kind === 'wait') {
    const nextActionAt = new Date(now.getTime() + step.durationMs);
    const nextIdx = idx + 1;
    await drizzle
      .update(emailAutomationRun)
      .set({
        currentStep: nextIdx,
        nextActionAt: nextIdx >= steps.length ? null : nextActionAt,
        status: nextIdx >= steps.length ? 'completed' : 'running',
        finishedAt: nextIdx >= steps.length ? now : null,
      })
      .where(eq(emailAutomationRun.id, run.id));
    return nextIdx >= steps.length;
  }

  throw new Error(`Step kind inconnu : ${(step as AutomationStep).kind}`);
}

function parseSteps(raw: unknown): AutomationSteps {
  const parsed = automationStepsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Steps JSON invalide : ${parsed.error.message}`);
  }
  return parsed.data;
}

function rowsOfRun(
  result: { rows: EmailAutomationRunRow[] } | EmailAutomationRunRow[],
): EmailAutomationRunRow[] {
  return rowsOf(result as unknown as { rows: EmailAutomationRunRow[] } | EmailAutomationRunRow[]).map(
    (r) => normalizeRow(r as Record<string, unknown>),
  );
}

function normalizeRow(raw: Record<string, unknown>): EmailAutomationRunRow {
  return {
    id: raw.id as string,
    automationId: raw.automation_id as string,
    recipientEmail: raw.recipient_email as string,
    triggeredAt: raw.triggered_at as Date,
    currentStep: raw.current_step as number,
    status: raw.status as EmailAutomationRunRow['status'],
    contextJson: raw.context_json as Record<string, unknown>,
    nextActionAt: (raw.next_action_at as Date | null) ?? null,
    finishedAt: (raw.finished_at as Date | null) ?? null,
    outboxIds: raw.outbox_ids as string[],
  };
}
