import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runInsightsIngestion, buildSourceKey } from './insights-worker';
import {
  listPerformanceSnapshotsForPosts,
} from './repository';
import { resetMemoryStore } from '@/lib/db/client';
import {
  createPublication,
  createPublishJob,
  upsertSocialAccount,
  updatePublishJobStatus,
} from '@/lib/social-publishing/repository';
import type {
  SocialAccount,
  SocialPublishingAdapter,
  SocialInsightsRequest,
  SocialInsightsResult,
} from '@/lib/social-publishing/contracts';

const now = new Date('2026-05-22T10:00:00.000Z');
const publishedAt = new Date('2026-05-19T10:00:00.000Z'); // 72h-ish before
const publishedInWindow = new Date('2026-05-20T10:00:00.000Z'); // 48h before

beforeEach(() => {
  resetMemoryStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function seed(accountId = 'acct_dry_1', publishedDate: Date = publishedInWindow): Promise<{
  account: SocialAccount;
  postId: string;
  remoteId: string;
}> {
  const account = await upsertSocialAccount({
    provider: 'dry_run',
    platform: 'instagram',
    remoteId: 'remote_acct_dry_1',
    name: 'Dry Run',
    status: 'active',
    capabilities: [],
  });
  const postId = 'po_seed_1';
  const remoteId = 'remote_post_seed_1';
  const job = await createPublishJob({
    postId,
    accountId: account.id,
    provider: 'dry_run',
    platform: 'instagram',
    format: 'post',
    idempotencyKey: 'idem_seed_1',
    content: {
      sourcePostId: postId,
      platform: 'instagram',
      format: 'post',
      caption: 'hello',
      media: [{ id: 'm', url: 'https://example.test/m.jpg' }],
    },
    requestedBy: null,
  });
  await updatePublishJobStatus({ jobId: job.id, status: 'published', publishedAt: publishedDate });
  await createPublication({
    jobId: job.id,
    postId,
    accountId: account.id,
    provider: 'dry_run',
    platform: 'instagram',
    remoteId,
    permalink: null,
    publishedAt: publishedDate,
  });
  return { account, postId, remoteId };
}

describe('runInsightsIngestion', () => {
  it('persists exactly one snapshot per (post, day) even when run back-to-back', async () => {
    const seeded = await seed();
    const summary1 = await runInsightsIngestion({ now });
    expect(summary1.scanned).toBe(1);
    expect(summary1.ingested).toBe(1);
    expect(summary1.skipped).toBe(0);

    const summary2 = await runInsightsIngestion({ now });
    expect(summary2.scanned).toBe(1);
    expect(summary2.ingested).toBe(0);
    expect(summary2.skipped).toBe(1);

    const snaps = await listPerformanceSnapshotsForPosts([seeded.postId]);
    expect(snaps).toHaveLength(1);
    expect(snaps[0]?.source).toBe(buildSourceKey('dry_run', seeded.remoteId, now));
    expect(snaps[0]?.metrics).toMatchObject({ provider: 'dry_run', remoteId: seeded.remoteId });
  });

  it("ignores publications outside the [now-72h, now-24h] window", async () => {
    await seed('acct_too_recent', new Date('2026-05-22T05:00:00.000Z')); // <24h
    const summary = await runInsightsIngestion({ now });
    expect(summary.scanned).toBe(0);
  });

  it('marks failures without aborting the batch', async () => {
    const seeded = await seed();
    const failing: SocialPublishingAdapter = {
      provider: 'dry_run',
      listCapabilities: () => [],
      async publish() {
        throw new Error('not used');
      },
      async getInsights(_request: SocialInsightsRequest): Promise<SocialInsightsResult> {
        return {
          ok: false,
          error: {
            code: 'provider_unavailable',
            message: 'simulated 503',
            retryable: true,
            status: 503,
          },
        };
      },
    };
    const summary = await runInsightsIngestion({
      now,
      resolveAdapter: () => failing,
    });
    expect(summary.failed).toBe(1);
    expect(summary.ingested).toBe(0);
    const snaps = await listPerformanceSnapshotsForPosts([seeded.postId]);
    expect(snaps).toHaveLength(0);
  });

  it('skips when no adapter supports getInsights', async () => {
    await seed();
    const noInsight: SocialPublishingAdapter = {
      provider: 'dry_run',
      listCapabilities: () => [],
      async publish() {
        throw new Error('not used');
      },
    };
    const summary = await runInsightsIngestion({
      now,
      resolveAdapter: () => noInsight,
    });
    expect(summary.skipped).toBe(1);
    expect(summary.ingested).toBe(0);
  });
});

describe('buildSourceKey', () => {
  it('encodes provider + remoteId + UTC day', () => {
    expect(buildSourceKey('postiz', 'abc123', new Date('2026-05-22T23:59:59.000Z'))).toBe(
      'postiz:abc123:2026-05-22',
    );
  });
});
