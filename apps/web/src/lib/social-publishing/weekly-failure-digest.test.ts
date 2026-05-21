import { describe, expect, it } from 'vitest';

import { buildWeeklyFailureDigest } from './weekly-failure-digest';
import type { SocialPublishJob } from './contracts';

const now = new Date('2026-05-21T08:00:00.000Z');
const sixDaysAgo = new Date('2026-05-15T08:00:00.000Z');
const eightDaysAgo = new Date('2026-05-13T08:00:00.000Z');

function failedJob(overrides: Partial<SocialPublishJob>): SocialPublishJob {
  const base: SocialPublishJob = {
    id: 'job_x',
    postId: 'post_x',
    accountId: 'acct_x',
    provider: 'postiz',
    platform: 'instagram',
    format: 'post',
    status: 'failed',
    idempotencyKey: 'idem_x',
    content: { sourcePostId: 'post_x', platform: 'instagram', format: 'post', caption: '', media: [] },
    scheduledAt: null,
    publishedAt: null,
    lockedAt: null,
    attemptCount: 1,
    lastError: { code: 'provider_unavailable', message: 'Postiz 503', retryable: true },
    requestedBy: null,
    createdAt: now,
    updatedAt: now,
  };
  return { ...base, ...overrides };
}

describe('buildWeeklyFailureDigest', () => {
  it('renvoie un digest vide quand aucune erreur', async () => {
    const digest = await buildWeeklyFailureDigest({ now, jobs: [] });
    expect(digest.total).toBe(0);
    expect(digest.buckets).toEqual([]);
    expect(digest.subject).toMatch(/0 échec/);
    expect(digest.text).toMatch(/Aucun échec/);
    expect(digest.html).toMatch(/Aucun échec/);
  });

  it('exclut les échecs hors fenêtre de 7 jours', async () => {
    const digest = await buildWeeklyFailureDigest({
      now,
      jobs: [
        failedJob({ id: 'in', updatedAt: sixDaysAgo }),
        failedJob({ id: 'out', updatedAt: eightDaysAgo }),
      ],
    });
    expect(digest.total).toBe(1);
    expect(digest.buckets).toHaveLength(1);
  });

  it('regroupe par provider/platform/errorCode et compte les retryables', async () => {
    const digest = await buildWeeklyFailureDigest({
      now,
      jobs: [
        failedJob({ id: 'a', updatedAt: now, lastError: { code: 'provider_unavailable', message: '503', retryable: true } }),
        failedJob({ id: 'b', updatedAt: now, lastError: { code: 'provider_unavailable', message: '503 again', retryable: true } }),
        failedJob({
          id: 'c',
          updatedAt: now,
          platform: 'facebook',
          lastError: { code: 'token_expired', message: '401', retryable: false },
        }),
      ],
    });
    expect(digest.total).toBe(3);
    expect(digest.buckets).toHaveLength(2);
    const ig503 = digest.buckets.find((b) => b.platform === 'instagram');
    expect(ig503).toMatchObject({ count: 2, retryableCount: 2, errorCode: 'provider_unavailable' });
    const fbAuth = digest.buckets.find((b) => b.platform === 'facebook');
    expect(fbAuth).toMatchObject({ count: 1, retryableCount: 0, errorCode: 'token_expired' });
  });

  it('mappe lastError null vers errorCode "unknown"', async () => {
    const digest = await buildWeeklyFailureDigest({
      now,
      jobs: [failedJob({ id: 'no-err', lastError: null, updatedAt: now })],
    });
    expect(digest.buckets[0]).toMatchObject({ errorCode: 'unknown', count: 1, retryableCount: 0 });
  });

  it('produit un sujet avec le nombre d échecs', async () => {
    const digest = await buildWeeklyFailureDigest({
      now,
      jobs: [
        failedJob({ id: 'a', updatedAt: now }),
        failedJob({ id: 'b', updatedAt: now }),
      ],
    });
    expect(digest.subject).toMatch(/2 échec/);
  });
});
