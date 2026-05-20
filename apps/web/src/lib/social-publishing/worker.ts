import { executeJob } from './admin-service';
import { listScheduledJobsDue } from './repository';

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

  const due = await listScheduledJobsDue({ now, limit });
  let executed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ jobId: string; message: string }> = [];

  for (const job of due) {
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
    tookMs: Date.now() - startedAt,
    errors,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
