import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from './media';
import {
  enqueueJob,
  findPendingJob,
  claimNextPendingJob,
  markJobDone,
  markJobFailed,
  findJobById,
  listJobsByMedia,
  jobsHealth,
  recoverFailedJobs,
  jobConfig,
} from './media-jobs';

async function newMedia(slug = 'm-job') {
  return createMedia({ kind: 'image', source: 'upload', slug, alt: 'alt' });
}

describe('queries.media-jobs', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('enqueueJob crée un job pending', async () => {
    const m = await newMedia();
    const j = await enqueueJob({ mediaId: m.id, kind: 'optimize' });
    expect(j.status).toBe('pending');
    expect(j.attemptCount).toBe(0);
  });

  it('enqueueJob déduplique pending+in_progress', async () => {
    const m = await newMedia('mj-dup');
    const a = await enqueueJob({ mediaId: m.id, kind: 'optimize' });
    const b = await enqueueJob({ mediaId: m.id, kind: 'optimize' });
    expect(a.id).toBe(b.id);
  });

  it('findPendingJob retourne ou null', async () => {
    const m = await newMedia('mj-find');
    expect(await findPendingJob(m.id, 'optimize')).toBeNull();
    await enqueueJob({ mediaId: m.id, kind: 'optimize' });
    expect(await findPendingJob(m.id, 'optimize')).not.toBeNull();
  });

  it('claimNextPendingJob réclame le plus ancien', async () => {
    const m = await newMedia('mj-claim');
    await enqueueJob({ mediaId: m.id, kind: 'optimize' });
    const claimed = await claimNextPendingJob();
    expect(claimed?.status).toBe('in_progress');
    expect(claimed?.attemptCount).toBe(1);
  });

  it('claimNextPendingJob retourne null si rien à faire', async () => {
    expect(await claimNextPendingJob()).toBeNull();
  });

  it('markJobDone passe le statut à done', async () => {
    const m = await newMedia('mj-done');
    const j = await enqueueJob({ mediaId: m.id, kind: 'optimize' });
    await markJobDone(j.id);
    const after = await findJobById(j.id);
    expect(after?.status).toBe('done');
    expect(after?.finishedAt).not.toBeNull();
  });

  it('markJobFailed retry avec backoff si attempts < MAX', async () => {
    const m = await newMedia('mj-fail');
    const j = await enqueueJob({ mediaId: m.id, kind: 'optimize' });
    const claimed = await claimNextPendingJob();
    expect(claimed?.id).toBe(j.id);
    const result = await markJobFailed(j.id, 'boom');
    expect(result?.status).toBe('pending');
    expect(result?.errorMessage).toBe('boom');
    expect(result?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('markJobFailed marque failed après MAX_ATTEMPTS', async () => {
    vi.useFakeTimers();
    try {
      const m = await newMedia('mj-max');
      const j = await enqueueJob({ mediaId: m.id, kind: 'optimize' });
      for (let i = 0; i < jobConfig.MAX_ATTEMPTS; i += 1) {
        await claimNextPendingJob();
        await markJobFailed(j.id, `try ${i}`);
        vi.advanceTimersByTime(60_000_000);
      }
      const after = await findJobById(j.id);
      expect(after?.status).toBe('failed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('listJobsByMedia retourne les jobs ordonnés', async () => {
    const m = await newMedia('mj-list');
    await enqueueJob({ mediaId: m.id, kind: 'optimize' });
    await enqueueJob({ mediaId: m.id, kind: 'regenerate' });
    const list = await listJobsByMedia(m.id);
    expect(list).toHaveLength(2);
  });

  it('jobsHealth aggrège les statuts', async () => {
    const m = await newMedia('mj-health');
    const j = await enqueueJob({ mediaId: m.id, kind: 'optimize' });
    await markJobDone(j.id);
    const h = await jobsHealth();
    expect(h.done).toBe(1);
  });

  it('recoverFailedJobs ré-active les jobs failed récents', async () => {
    vi.useFakeTimers();
    try {
      const m = await newMedia('mj-rec');
      const j = await enqueueJob({ mediaId: m.id, kind: 'optimize' });
      for (let i = 0; i < jobConfig.MAX_ATTEMPTS; i += 1) {
        await claimNextPendingJob();
        await markJobFailed(j.id, `try ${i}`);
        vi.advanceTimersByTime(60_000_000);
      }
      const failed = await findJobById(j.id);
      expect(failed?.status).toBe('failed');
      const count = await recoverFailedJobs(7);
      expect(count).toBeGreaterThanOrEqual(1);
      const after = await findJobById(j.id);
      expect(after?.status).toBe('pending');
    } finally {
      vi.useRealTimers();
    }
  });
});
