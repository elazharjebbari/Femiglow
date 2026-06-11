import { executeJob, reapStalePublishJobs } from './admin-service';
import { listScheduledJobsDue } from './repository';
import { decideRetry, isDeadLetter, MAX_ATTEMPTS } from './retry-policy';
import { logger } from '@/lib/logging/logger';

export interface RunScheduledPublishJobsInput {
  now?: Date;
  limit?: number;
}

export interface RunScheduledPublishJobsResult {
  checked: number;
  executed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  /** Jobs zombies (publishing + verrou expiré) réinitialisés ce tick. */
  reaped: number;
  tookMs: number;
  errors: Array<{ jobId: string; message: string }>;
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

export async function runScheduledPublishJobs(
  input: RunScheduledPublishJobsInput = {},
): Promise<RunScheduledPublishJobsResult> {
  const startedAt = Date.now();
  const now = input.now ?? new Date();
  const limit = clamp(input.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);

  // Reaper d'abord : libère les jobs zombies avant de chercher les dus.
  const { reapedJobIds } = await reapStalePublishJobs({ now });

  const due = await listScheduledJobsDue({ now, limit });
  let executed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ jobId: string; message: string }> = [];

  for (const job of due) {
    // Sprint 4 C1 — Retry-policy guard. Si le job dépasse MAX_ATTEMPTS,
    // on skip silencieusement (et l'admin doit voir dans le dashboard
    // dead letters). Évite la boucle infinie de retries pour un job qui
    // échoue systématiquement (ex: token API révoqué).
    // Référence : docs/live-systems-fix-2026-05/07-system-publishing.md
    if (isDeadLetter(job.attemptCount ?? 0)) {
      skipped += 1;
      logger.warn('publishing.worker.dead_letter_skipped', {
        jobId: job.id,
        attemptCount: job.attemptCount,
        max: MAX_ATTEMPTS,
      });
      continue;
    }

    try {
      const outcome = await executeJob({ jobId: job.id, actorId: job.requestedBy });
      executed += 1;
      if (outcome.result.ok) {
        succeeded += 1;
      } else if (outcome.result.error.code === 'invalid_request' && /not available/i.test(outcome.result.error.message)) {
        skipped += 1;
        executed -= 1;
      } else {
        failed += 1;
        // Décision retry — informative pour observabilité. Le DB update
        // attemptCount/nextRetryAt est géré par executeJob côté admin-service
        // (cf. content_postiz_delivery.attempt_count colonne existante).
        const nextAttempt = (job.attemptCount ?? 0) + 1;
        const decision = decideRetry(nextAttempt);
        if (decision.isDeadLetter) {
          logger.warn('publishing.worker.job_dead_letter', {
            jobId: job.id,
            attemptCount: nextAttempt,
            reason: outcome.result.error.message,
          });
        } else {
          logger.info('publishing.worker.job_failed_will_retry', {
            jobId: job.id,
            nextRetryAt: decision.nextRetryAt?.toISOString(),
            attempt: `${nextAttempt}/${MAX_ATTEMPTS}`,
          });
        }
      }
    } catch (err) {
      failed += 1;
      errors.push({
        jobId: job.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    checked: due.length,
    executed,
    succeeded,
    failed,
    skipped,
    reaped: reapedJobIds.length,
    tookMs: Date.now() - startedAt,
    errors,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
