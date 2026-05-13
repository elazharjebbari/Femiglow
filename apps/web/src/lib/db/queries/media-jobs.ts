import { and, asc, eq, inArray, lte, sql as dsql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { rowsOf } from '@/lib/db/exec';
import { createId } from '@/lib/ids';
import type { MediaJob, MediaJobKind, MediaJobStatus } from '@/lib/db/types';

const MAX_ATTEMPTS = 4;
const BACKOFF_BASE_SECONDS = 5;

export interface EnqueueJobInput {
  mediaId: string;
  kind: MediaJobKind;
  payload?: Record<string, unknown>;
  delaySeconds?: number;
}

export async function enqueueJob(input: EnqueueJobInput): Promise<MediaJob> {
  const existing = await findPendingJob(input.mediaId, input.kind);
  if (existing) return existing;

  const job: MediaJob = {
    id: createId('mj'),
    mediaId: input.mediaId,
    kind: input.kind,
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: new Date(Date.now() + (input.delaySeconds ?? 0) * 1000),
    errorMessage: null,
    payload: input.payload ?? {},
    startedAt: null,
    finishedAt: null,
    createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.mediaJobs).values(job);
    return job;
  }
  memoryStore().mediaJobs.set(job.id, job);
  return job;
}

export async function findPendingJob(
  mediaId: string,
  kind: MediaJobKind,
): Promise<MediaJob | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.mediaJobs)
      .where(
        and(
          eq(schema.mediaJobs.mediaId, mediaId),
          eq(schema.mediaJobs.kind, kind),
          inArray(schema.mediaJobs.status, ['pending', 'in_progress']),
        ),
      )
      .limit(1);
    return (rows[0] as unknown as MediaJob | undefined) ?? null;
  }
  for (const j of memoryStore().mediaJobs.values()) {
    if (
      j.mediaId === mediaId &&
      j.kind === kind &&
      (j.status === 'pending' || j.status === 'in_progress')
    ) {
      return j;
    }
  }
  return null;
}

export async function claimNextPendingJob(): Promise<MediaJob | null> {
  const drizzle = db();
  const now = new Date();
  if (drizzle) {
    const claimSql = dsql`
      UPDATE media_jobs
      SET status = 'in_progress',
          started_at = now(),
          attempt_count = attempt_count + 1
      WHERE id = (
        SELECT id FROM media_jobs
        WHERE status = 'pending' AND next_attempt_at <= now()
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;
    // Cf. lib/db/exec.ts — db.execute() shape diverges between Neon ({rows:[]})
    // and postgres-js (array direct). Use rowsOf() to handle both safely.
    const result = await drizzle.execute<MediaJob>(claimSql);
    const rows = rowsOf(result);
    return rows[0] ?? null;
  }
  const store = memoryStore();
  const candidates = Array.from(store.mediaJobs.values())
    .filter((j) => j.status === 'pending' && j.nextAttemptAt <= now)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const job = candidates[0];
  if (!job) return null;
  const claimed: MediaJob = {
    ...job,
    status: 'in_progress',
    startedAt: now,
    attemptCount: job.attemptCount + 1,
  };
  store.mediaJobs.set(job.id, claimed);
  return claimed;
}

export async function markJobDone(id: string): Promise<void> {
  const drizzle = db();
  const now = new Date();
  if (drizzle) {
    await drizzle
      .update(schema.mediaJobs)
      .set({ status: 'done', finishedAt: now, errorMessage: null })
      .where(eq(schema.mediaJobs.id, id));
    return;
  }
  const store = memoryStore();
  const j = store.mediaJobs.get(id);
  if (!j) return;
  store.mediaJobs.set(id, { ...j, status: 'done', finishedAt: now, errorMessage: null });
}

export async function markJobFailed(id: string, errorMessage: string): Promise<MediaJob | null> {
  const drizzle = db();
  const now = new Date();
  const existing = await findJobById(id);
  if (!existing) return null;

  if (existing.attemptCount >= MAX_ATTEMPTS) {
    if (drizzle) {
      await drizzle
        .update(schema.mediaJobs)
        .set({ status: 'failed', finishedAt: now, errorMessage })
        .where(eq(schema.mediaJobs.id, id));
    } else {
      memoryStore().mediaJobs.set(id, {
        ...existing,
        status: 'failed',
        finishedAt: now,
        errorMessage,
      });
    }
    return { ...existing, status: 'failed', finishedAt: now, errorMessage };
  }

  const backoff = Math.pow(BACKOFF_BASE_SECONDS, existing.attemptCount);
  const nextAttemptAt = new Date(now.getTime() + backoff * 1000);
  if (drizzle) {
    await drizzle
      .update(schema.mediaJobs)
      .set({
        status: 'pending',
        nextAttemptAt,
        errorMessage,
        startedAt: null,
      })
      .where(eq(schema.mediaJobs.id, id));
  } else {
    memoryStore().mediaJobs.set(id, {
      ...existing,
      status: 'pending',
      nextAttemptAt,
      errorMessage,
      startedAt: null,
    });
  }
  return { ...existing, status: 'pending', nextAttemptAt, errorMessage, startedAt: null };
}

export async function findJobById(id: string): Promise<MediaJob | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.mediaJobs)
      .where(eq(schema.mediaJobs.id, id))
      .limit(1);
    return (rows[0] as unknown as MediaJob | undefined) ?? null;
  }
  return memoryStore().mediaJobs.get(id) ?? null;
}

export async function listJobsByMedia(mediaId: string, limit = 20): Promise<MediaJob[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.mediaJobs)
      .where(eq(schema.mediaJobs.mediaId, mediaId))
      .orderBy(asc(schema.mediaJobs.createdAt))
      .limit(limit);
    return rows as unknown as MediaJob[];
  }
  return Array.from(memoryStore().mediaJobs.values())
    .filter((j) => j.mediaId === mediaId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(0, limit);
}

export interface JobsHealth {
  pending: number;
  inProgress: number;
  failed: number;
  done: number;
}

export async function jobsHealth(): Promise<JobsHealth> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select({
        status: schema.mediaJobs.status,
        c: dsql<number>`count(*)::int`,
      })
      .from(schema.mediaJobs)
      .groupBy(schema.mediaJobs.status);
    const result: JobsHealth = { pending: 0, inProgress: 0, failed: 0, done: 0 };
    for (const r of rows) {
      const status = r.status as MediaJobStatus;
      const count = r.c ?? 0;
      if (status === 'pending') result.pending = count;
      if (status === 'in_progress') result.inProgress = count;
      if (status === 'failed') result.failed = count;
      if (status === 'done') result.done = count;
    }
    return result;
  }
  const all = Array.from(memoryStore().mediaJobs.values());
  return {
    pending: all.filter((j) => j.status === 'pending').length,
    inProgress: all.filter((j) => j.status === 'in_progress').length,
    failed: all.filter((j) => j.status === 'failed').length,
    done: all.filter((j) => j.status === 'done').length,
  };
}

export async function recoverFailedJobs(sinceDays = 7): Promise<number> {
  const drizzle = db();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  if (drizzle) {
    // CHA — `.returning(fields)` collapse sur l'union `DrizzleNeon | DrizzlePg`
    // (seul l'overload sans args survit). On ne consomme que `.length` ici,
    // donc l'overload no-arg est strictement équivalent et évite tout cast.
    const rows = await drizzle
      .update(schema.mediaJobs)
      .set({ status: 'pending', attemptCount: 0, nextAttemptAt: now, errorMessage: null })
      .where(and(eq(schema.mediaJobs.status, 'failed'), lte(schema.mediaJobs.createdAt, now)))
      .returning();
    return rows.length;
  }
  const store = memoryStore();
  let count = 0;
  for (const j of Array.from(store.mediaJobs.values())) {
    if (j.status === 'failed' && j.createdAt >= since) {
      store.mediaJobs.set(j.id, {
        ...j,
        status: 'pending',
        attemptCount: 0,
        nextAttemptAt: now,
        errorMessage: null,
      });
      count += 1;
    }
  }
  return count;
}

export const jobConfig = {
  MAX_ATTEMPTS,
  BACKOFF_BASE_SECONDS,
} as const;
