import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from '@/lib/db/queries/media';
import { createContentIdea } from '@/lib/content-studio/service';
import {
  approveDraft,
  createBrief,
  createDrafts,
  upsertPrimaryAsset,
} from '@/lib/content-studio/repository';
import {
  createPublishJob,
  getPublishJob,
  tryAcquirePublishJobLock,
  upsertSocialAccount,
} from './repository';
import type { SocialPublishContent } from './contracts';
import { runScheduledPublishJobs } from './worker';

const content: SocialPublishContent = {
  sourcePostId: 'cp_worker',
  platform: 'instagram',
  format: 'post',
  caption: 'Routine FemiGlow worker',
  media: [
    {
      id: 'me_worker',
      url: 'https://cdn.femiglow.test/worker.png',
      mimeType: 'image/png',
      width: 1024,
      height: 1024,
      alt: 'Routine worker',
    },
  ],
  tags: ['routine'],
};

async function approvedInstagramPost() {
  const idea = await createContentIdea({
    pillar: 'rituel',
    objective: 'conversion',
    platform: 'instagram',
    format: 'post',
    prompt: 'Worker scheduler test.',
    actorId: 'adm_worker',
  });
  const brief = await createBrief({
    ideaId: idea.id,
    angle: 'Worker',
    cta: 'Découvrir',
    actorId: 'adm_worker',
  });
  const [draft] = await createDrafts([
    {
      briefId: brief.id,
      platform: 'instagram',
      format: 'post',
      variantLabel: 'A',
      caption: 'Routine worker FemiGlow',
      altText: 'Worker test',
      hashtags: ['routine'],
    },
  ]);
  if (!draft) throw new Error('Draft fixture missing');
  const media = await createMedia({
    kind: 'image',
    source: 'upload',
    slug: `worker-${draft.id}`,
    alt: 'Worker test',
    originalUrl: 'https://cdn.femiglow.test/worker.png',
    originalMime: 'image/png',
    originalWidth: 1024,
    originalHeight: 1024,
    status: 'ready',
  });
  await upsertPrimaryAsset({ draftId: draft.id, mediaId: media.id });
  return approveDraft({ draftId: draft.id, actorId: 'adm_worker' });
}

async function dryRunAccount() {
  return upsertSocialAccount({
    provider: 'dry_run',
    platform: 'instagram',
    remoteId: 'ig_worker',
    name: 'IG worker test',
  });
}

describe('runScheduledPublishJobs', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('exécute un job queued dont scheduled_at est passé', async () => {
    const post = await approvedInstagramPost();
    const account = await dryRunAccount();
    const past = new Date('2026-05-19T08:00:00Z');
    const job = await createPublishJob({
      postId: post.id,
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'worker:1',
      content: { ...content, sourcePostId: post.id },
      scheduledAt: past,
    });

    const result = await runScheduledPublishJobs({ now: new Date('2026-05-20T00:00:00Z'), limit: 5 });
    expect(result.checked).toBe(1);
    expect(result.executed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);

    const updated = await getPublishJob(job.id);
    expect(updated?.status).toBe('published');
  });

  it('ignore les jobs sans scheduled_at (publish-now)', async () => {
    const post = await approvedInstagramPost();
    const account = await dryRunAccount();
    await createPublishJob({
      postId: post.id,
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'worker:no-scheduled',
      content: { ...content, sourcePostId: post.id },
    });
    const result = await runScheduledPublishJobs({ now: new Date('2026-05-20T00:00:00Z'), limit: 5 });
    expect(result.checked).toBe(0);
    expect(result.executed).toBe(0);
  });

  it('ignore les jobs déjà lockés par un autre worker', async () => {
    const post = await approvedInstagramPost();
    const account = await dryRunAccount();
    const past = new Date('2026-05-19T08:00:00Z');
    const job = await createPublishJob({
      postId: post.id,
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'worker:locked',
      content: { ...content, sourcePostId: post.id },
      scheduledAt: past,
    });
    await tryAcquirePublishJobLock({ jobId: job.id, allowedFromStatuses: ['queued', 'failed'] });

    const result = await runScheduledPublishJobs({ now: new Date('2026-05-20T00:00:00Z'), limit: 5 });
    expect(result.checked).toBe(0);
  });

  it('respecte la limite et traite les jobs dans l ordre ascendant par scheduled_at', async () => {
    const post = await approvedInstagramPost();
    const account = await dryRunAccount();
    const jobA = await createPublishJob({
      postId: post.id,
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'worker:limit:a',
      content: { ...content, sourcePostId: post.id },
      scheduledAt: new Date('2026-05-19T10:00:00Z'),
    });
    const jobB = await createPublishJob({
      postId: post.id,
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'worker:limit:b',
      content: { ...content, sourcePostId: post.id },
      scheduledAt: new Date('2026-05-19T08:00:00Z'),
    });
    await createPublishJob({
      postId: post.id,
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'worker:limit:c',
      content: { ...content, sourcePostId: post.id },
      scheduledAt: new Date('2026-05-19T12:00:00Z'),
    });

    const result = await runScheduledPublishJobs({ now: new Date('2026-05-20T00:00:00Z'), limit: 2 });
    expect(result.checked).toBe(2);
    expect(result.executed).toBe(2);
    expect(result.succeeded).toBe(2);

    const [a, b] = await Promise.all([getPublishJob(jobA.id), getPublishJob(jobB.id)]);
    expect(a?.status).toBe('published');
    expect(b?.status).toBe('published');
  });

  it('borne la limite à MAX_LIMIT (clamp)', async () => {
    const result = await runScheduledPublishJobs({ now: new Date('2026-05-20T00:00:00Z'), limit: 9999 });
    expect(result.checked).toBe(0);
    // pas d'erreur, just clamp interne sans crash
  });
});
