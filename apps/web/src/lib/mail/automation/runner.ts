/**
 * Automation runner V2 — picks up due `email_automation_run` rows and
 * advances them one step at a time.
 *
 * Called by /api/cron/email-automation every 60s.
 *
 *   1. SELECT runs with status='running' AND nextActionAt <= now()
 *   2. For each run :
 *        - load parent automation steps (V2 schema)
 *        - resolve current step via stepPath (contextJson._path, default [currentStep])
 *        - descend through branches lazily (evaluate condition then descend)
 *        - dispatch by kind (wait/send/tag/update_lead/webhook/wait_for_event)
 *        - persist next path + state
 *   3. Return summary
 *
 * Idempotent : `FOR UPDATE SKIP LOCKED` so concurrent runners don't collide.
 * Errors per-run are caught and demote that run to status='errored'.
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
  AutomationStepSchema,
  type AutomationStep,
} from './step-types-v2';
import { z } from 'zod';
import { evaluateConditionAgainstUser } from './condition-evaluator';
import { handleTagStep } from './step-handlers/tag';
import { handleUpdateLeadStep } from './step-handlers/update-lead';
import { handleWebhookStep } from './step-handlers/webhook';
import {
  descendToExecutable,
  getStepAtPath,
  isValidPath,
  nextPath,
  type StepPath,
} from './step-handlers/step-path';
import { sweepOrphanRuns } from './orphan-sweep';
import { applyQuietHours, checkCooldown, checkDailyCap } from './frequency';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

type AutomationContext = Record<string, unknown> & {
  recipientEmail: string;
};

const automationStepsSchema = z.array(AutomationStepSchema);

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
  /** Runs orphelins ré-armés par le sweep (chantier 1.4). */
  orphansRearmed: number;
  /** Runs orphelins non-reconstructibles passés en errored par le sweep. */
  orphansErrored: number;
  durationMs: number;
};

export async function tickAutomation(now: Date = new Date()): Promise<RunnerResult> {
  const drizzle = requireDb();
  const startedAt = Date.now();

  // ── Sweep des runs orphelins AVANT le claim (chantier 1.4) ───────────────
  // Ré-arme les zombies running+next_action_at=NULL reconstructibles pour qu'ils
  // soient re-claimés dans CE tick ; erreure les non-reconstructibles.
  const orphan = await sweepOrphanRuns(now);

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
        .set({
          status: 'errored',
          finishedAt: new Date(),
          nextActionAt: null,
          erroredAt: new Date(),
          erroredReason: msg.slice(0, 500),
        })
        .where(eq(emailAutomationRun.id, run.id));
    }
  }

  return {
    picked: picked.length,
    advanced,
    completed,
    errored,
    orphansRearmed: orphan.rearmed,
    orphansErrored: orphan.errored,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Process a single run : resolve the current step, dispatch, schedule next.
 * Returns true if the run is completed.
 */
async function processRun(run: EmailAutomationRunRow, now: Date): Promise<boolean> {
  const drizzle = requireDb();

  const [auto] = await drizzle
    .select()
    .from(emailAutomation)
    .where(eq(emailAutomation.id, run.automationId))
    .limit(1);
  if (!auto) throw new Error(`Automation ${run.automationId} introuvable`);

  if (!auto.active) {
    await drizzle
      .update(emailAutomationRun)
      .set({ status: 'cancelled', finishedAt: now, nextActionAt: null })
      .where(eq(emailAutomationRun.id, run.id));
    return true;
  }

  const steps = parseSteps(auto.steps);
  const ctx = (run.contextJson as AutomationContext) ?? { recipientEmail: run.recipientEmail };

  // Resolve path : contextJson._path takes precedence; legacy fallback uses currentStep
  const ctxPath = (ctx._path as unknown) ?? null;
  let path: StepPath = isValidPath(ctxPath) ? ctxPath : [run.currentStep];

  // Descend through branches lazily
  const descended = await descendToExecutable(steps, path, async (cond: RulesGroup) => {
    return evaluateConditionAgainstUser(cond, run.recipientEmail);
  });
  if (!descended) {
    await drizzle
      .update(emailAutomationRun)
      .set({ status: 'completed', finishedAt: now, nextActionAt: null })
      .where(eq(emailAutomationRun.id, run.id));
    return true;
  }
  path = descended;

  const step = getStepAtPath(steps, path);
  if (!step) {
    await drizzle
      .update(emailAutomationRun)
      .set({ status: 'completed', finishedAt: now, nextActionAt: null })
      .where(eq(emailAutomationRun.id, run.id));
    return true;
  }

  const advance = async (extra?: {
    nextActionAt?: Date;
    outboxIds?: string[];
  }): Promise<boolean> => {
    const np = nextPath(steps, path);
    const newCtx = { ...ctx, _path: np } as Record<string, unknown>;
    if (!np) {
      await drizzle
        .update(emailAutomationRun)
        .set({
          status: 'completed',
          finishedAt: now,
          nextActionAt: null,
          contextJson: newCtx,
          ...(extra?.outboxIds ? { outboxIds: extra.outboxIds } : {}),
        })
        .where(eq(emailAutomationRun.id, run.id));
      return true;
    }
    await drizzle
      .update(emailAutomationRun)
      .set({
        currentStep: typeof np[0] === 'number' ? np[0] : run.currentStep,
        nextActionAt: extra?.nextActionAt ?? now,
        contextJson: newCtx,
        status: 'running',
        ...(extra?.outboxIds ? { outboxIds: extra.outboxIds } : {}),
      })
      .where(eq(emailAutomationRun.id, run.id));
    return false;
  };

  /**
   * DIFFÈRE le run SANS le faire avancer : on reste sur le step courant et on
   * repousse `next_action_at`. Utilisé par les quiet hours — le step d'envoi
   * sera ré-évalué (et envoyé) au prochain claim une fois la fenêtre rouverte.
   *
   * Idempotence : le path NE change PAS et `next_action_at` est posé à l'instant
   * cible CALCULÉ (déterministe via applyQuietHours). Deux ticks pendant la nuit
   * recalculent le même `start` local → même `next_action_at`, donc PAS de
   * double-décalage (le différé ne « glisse » pas tick après tick).
   */
  const defer = async (until: Date, reason: string): Promise<boolean> => {
    const newCtx = { ...ctx, _path: path, _deferredReason: reason, _deferredUntil: until.toISOString() } as Record<string, unknown>;
    await drizzle
      .update(emailAutomationRun)
      .set({ status: 'running', nextActionAt: until, contextJson: newCtx })
      .where(eq(emailAutomationRun.id, run.id));
    return false;
  };

  /**
   * SKIP un step d'envoi (cooldown / daily cap) : on N'ENVOIE PAS mais on AVANCE
   * (le run n'est ni perdu ni bloqué). La raison est persistée dans contextJson
   * (`_skippedReason` + `_skippedStep`) pour l'observabilité de la timeline.
   */
  const skipSend = async (reason: string): Promise<boolean> => {
    logger.info('automation.send.skipped', {
      runId: run.id,
      slug: auto.slug,
      step: pathToString(path),
      reason,
    });
    ctx._skippedReason = reason;
    ctx._skippedStep = pathToString(path);
    return advance();
  };

  // ── Dispatch by kind ───────────────────────────────────────────────────
  switch (step.kind) {
    case 'send': {
      if (!isKnownTemplate(step.template)) {
        throw new Error(`Template inconnu : ${step.template}`);
      }

      // ── Contrôles de fréquence (chantier 1.8 — frequency.ts câblé) ───────
      // Ordre : daily cap (automation entière) → cooldown (par destinataire) →
      // quiet hours (différé). cap/cooldown SKIPPENT le send ; quiet hours le
      // DIFFÈRE (rien n'est perdu).
      const cap = await checkDailyCap(auto.id, auto.dailyCap, {
        tz: auto.quietHoursTz,
        now,
      });
      if (cap.blocked) {
        return skipSend(`daily_cap_reached(${cap.todayCount}/${auto.dailyCap})`);
      }

      const cooldown = await checkCooldown(auto.id, run.recipientEmail, auto.cooldownSeconds, {
        excludeRunId: run.id,
        now,
      });
      if (cooldown.blocked) {
        return skipSend(
          `cooldown_active(last=${cooldown.lastRunAt?.toISOString() ?? '?'}, window=${auto.cooldownSeconds}s)`,
        );
      }

      const sendAt = applyQuietHours(now, {
        quietHoursEnabled: auto.quietHoursEnabled,
        quietHoursStart: auto.quietHoursStart,
        quietHoursEnd: auto.quietHoursEnd,
        quietHoursTz: auto.quietHoursTz,
      });
      if (sendAt.getTime() > now.getTime()) {
        // Hors fenêtre autorisée → différé au prochain `start` local, pas d'envoi.
        return defer(sendAt, `quiet_hours(until=${sendAt.toISOString()})`);
      }

      const payload: Record<string, unknown> = {};
      const keys = step.payloadKeys ?? [];
      for (const k of keys) payload[k] = ctx[k];
      if (step.varMappings) {
        for (const [varName, ctxKey] of Object.entries(step.varMappings)) {
          payload[varName] = ctx[ctxKey];
        }
      }
      const stepLabel = pathToString(path);
      const idempotencyKey = `automation:${run.id}:step${stepLabel}`;
      const result = await sendTransactional({
        template: step.template as TemplateSlug,
        to: { email: run.recipientEmail },
        payload: payload as never,
        idempotencyKey,
        source: `automation.${auto.slug}.step${stepLabel}`,
      });
      const outboxIds = Array.isArray(run.outboxIds) ? [...(run.outboxIds as string[])] : [];
      if (result.status === 'queued' || result.status === 'duplicate') {
        outboxIds.push(result.outboxId);
      }
      return advance({ outboxIds });
    }

    case 'wait': {
      const nextActionAt = new Date(now.getTime() + step.durationMs);
      return advance({ nextActionAt });
    }

    case 'tag': {
      await handleTagStep(step, run.recipientEmail, auto.slug);
      return advance();
    }

    case 'update_lead': {
      await handleUpdateLeadStep(step, run.recipientEmail);
      return advance();
    }

    case 'webhook': {
      await handleWebhookStep(step, run.recipientEmail);
      return advance();
    }

    case 'wait_for_event': {
      const awaitingUntil = new Date(now.getTime() + step.timeoutMs);
      const newCtx = { ...ctx, _path: path } as Record<string, unknown>;
      await drizzle
        .update(emailAutomationRun)
        .set({
          status: 'waiting_for_event',
          awaitingEventName: step.eventName,
          awaitingUntil,
          nextActionAt: awaitingUntil, // re-pick if timeout passes
          contextJson: newCtx,
        })
        .where(eq(emailAutomationRun.id, run.id));
      return false;
    }

    case 'branch': {
      // Shouldn't happen — descendToExecutable resolved any branch
      throw new Error(`Branch step encountered post-descent at path ${pathToString(path)}`);
    }

    default: {
      const exhaustive: never = step;
      throw new Error(`Step kind inconnu : ${(exhaustive as { kind: string }).kind}`);
    }
  }
}

function pathToString(path: StepPath): string {
  return path.map((seg) => (typeof seg === 'number' ? String(seg) : seg)).join('.');
}

function parseSteps(raw: unknown): AutomationStep[] {
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
    awaitingEventName: (raw.awaiting_event_name as string | null) ?? null,
    awaitingUntil: (raw.awaiting_until as Date | null) ?? null,
    erroredAt: (raw.errored_at as Date | null) ?? null,
    erroredReason: (raw.errored_reason as string | null) ?? null,
  };
}
