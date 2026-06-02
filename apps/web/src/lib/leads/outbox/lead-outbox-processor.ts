/**
 * OWBS — Processor de `lead_event_outbox` (drain).
 *
 * Appelé par le cron `/api/cron/lead-outbox` (~60 s). Claim un lot
 * (`pickBatch`, FOR UPDATE SKIP LOCKED), exécute le handler de chaque effet,
 * puis `markDone` (succès) ou `reschedule` (échec → backoff / dead).
 *
 * @see docs/checkout-leads-background-2026-06-01/02-data-flow/flows.md F6
 */
import { logger } from '@/lib/logging/logger';

import { getLeadEffectHandler } from './handlers';
import { leadOutboxRepo } from './lead-outbox-repo';

const BATCH_SIZE = 100;

// `type` (et non `interface`) pour rester assignable à `Record<string, unknown>`
// quand on le passe au logger structuré.
export type ProcessResult = {
  picked: number;
  done: number;
  rescheduled: number;
  dead: number;
  durationMs: number;
};

export async function pickAndProcessBatch(now: Date = new Date()): Promise<ProcessResult> {
  const startedAt = Date.now();
  const rows = await leadOutboxRepo.pickBatch(BATCH_SIZE, now);

  let done = 0;
  let rescheduled = 0;
  let dead = 0;

  for (const row of rows) {
    try {
      const handler = getLeadEffectHandler(row.type);
      if (!handler) throw new Error(`no handler registered for effect type "${row.type}"`);
      await handler(row);
      await leadOutboxRepo.markDone(row.id);
      done += 1;
      logger.info('owbs.outbox.done', { id: row.id, type: row.type });
    } catch (err) {
      const { dead: isDead, attempts } = await leadOutboxRepo.reschedule(row, err, now);
      if (isDead) {
        dead += 1;
        logger.error('owbs.outbox.dead', { id: row.id, type: row.type, attempts });
      } else {
        rescheduled += 1;
        logger.warn('owbs.outbox.reschedule', { id: row.id, type: row.type, attempts });
      }
    }
  }

  return { picked: rows.length, done, rescheduled, dead, durationMs: Date.now() - startedAt };
}
