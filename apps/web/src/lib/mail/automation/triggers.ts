/**
 * Trigger helpers — enqueue an `email_automation_run` row from app code.
 *
 *   triggerAutomation('cart-abandoned-1h', { recipientEmail, ...vars })
 *
 * Idempotency : per (automationSlug, recipientEmail, dedupeKey). If a run
 * already exists with same dedupe key in last 24h, we skip.
 */
import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';
import type { AutomationContext } from './types';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type TriggerResult = { status: 'enqueued' | 'duplicate' | 'disabled' | 'unknown'; runId?: string };

export async function triggerAutomation(
  automationSlug: string,
  ctx: AutomationContext,
  opts: { dedupeKey?: string; dedupeWindowMs?: number } = {},
): Promise<TriggerResult> {
  const drizzle = requireDb();
  const dedupeWindow = opts.dedupeWindowMs ?? 24 * 60 * 60_000;
  const recipientEmail = ctx.recipientEmail.toLowerCase().trim();

  const [auto] = await drizzle
    .select()
    .from(emailAutomation)
    .where(eq(emailAutomation.slug, automationSlug))
    .limit(1);

  if (!auto) {
    logger.warn('automation.trigger.unknown', { slug: automationSlug });
    return { status: 'unknown' };
  }
  if (!auto.active) {
    logger.info('automation.trigger.disabled', { slug: automationSlug });
    return { status: 'disabled' };
  }

  // Idempotency window check
  if (opts.dedupeKey) {
    const since = new Date(Date.now() - dedupeWindow);
    const [existing] = await drizzle
      .select({ id: emailAutomationRun.id })
      .from(emailAutomationRun)
      .where(
        and(
          eq(emailAutomationRun.automationId, auto.id),
          eq(emailAutomationRun.recipientEmail, recipientEmail),
          gte(emailAutomationRun.triggeredAt, since),
          sql`${emailAutomationRun.contextJson}->>'dedupeKey' = ${opts.dedupeKey}`,
        ),
      )
      .limit(1);
    if (existing) {
      return { status: 'duplicate', runId: existing.id };
    }
  }

  const runId = randomUUID();
  const now = new Date();
  const ctxWithDedupe = { ...ctx, ...(opts.dedupeKey ? { dedupeKey: opts.dedupeKey } : {}) };
  await drizzle.insert(emailAutomationRun).values({
    id: runId,
    automationId: auto.id,
    recipientEmail,
    triggeredAt: now,
    currentStep: 0,
    status: 'running',
    contextJson: ctxWithDedupe,
    nextActionAt: now, // pick up on the very next cron tick
    outboxIds: [],
  });

  logger.info('automation.triggered', {
    slug: automationSlug,
    runId,
    recipientEmail,
    dedupeKey: opts.dedupeKey,
  });
  return { status: 'enqueued', runId };
}
