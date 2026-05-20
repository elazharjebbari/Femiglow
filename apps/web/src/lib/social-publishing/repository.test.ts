import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import type { SocialPublishContent } from './contracts';
import {
  createPublication,
  createPublishJob,
  getPublishJob,
  listPublicationsForPost,
  listPublishEvents,
  listPublishJobs,
  listSocialAccounts,
  recordPublishAttempt,
  updatePublishJobStatus,
  upsertSocialAccount,
} from './repository';

const content: SocialPublishContent = {
  sourcePostId: 'cp_1',
  platform: 'instagram',
  format: 'post',
  caption: 'Routine FemiGlow du soir',
  media: [
    {
      id: 'me_1',
      url: 'https://femiglow.test/media/me_1.png',
      mimeType: 'image/png',
      width: 1024,
      height: 1024,
      alt: 'Routine skincare',
    },
  ],
  tags: ['routine'],
};

describe('social-publishing repository', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('upsert les comptes sociaux par provider et remote id', async () => {
    const first = await upsertSocialAccount({
      provider: 'dry_run',
      platform: 'instagram',
      remoteId: 'ig_123',
      name: 'IG test',
    });
    const second = await upsertSocialAccount({
      provider: 'dry_run',
      platform: 'instagram',
      remoteId: 'ig_123',
      name: 'IG test updated',
      status: 'disabled',
    });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe('IG test updated');
    expect(second.status).toBe('disabled');
    await expect(listSocialAccounts({ provider: 'dry_run' })).resolves.toHaveLength(1);
  });

  it('rend la création de job idempotente', async () => {
    const account = await upsertSocialAccount({
      provider: 'dry_run',
      platform: 'instagram',
      remoteId: 'ig_123',
      name: 'IG test',
    });
    const first = await createPublishJob({
      postId: 'cp_1',
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'publish:cp_1:ig_123',
      content,
      requestedBy: 'adm_1',
    });
    const second = await createPublishJob({
      postId: 'cp_1',
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'publish:cp_1:ig_123',
      content,
      requestedBy: 'adm_1',
    });

    expect(second.id).toBe(first.id);
    await expect(listPublishJobs({ postId: 'cp_1' })).resolves.toHaveLength(1);
  });

  it('redacte les secrets dans les attempts et garde le compteur de tentative', async () => {
    const account = await upsertSocialAccount({
      provider: 'dry_run',
      platform: 'instagram',
      remoteId: 'ig_123',
      name: 'IG test',
    });
    const job = await createPublishJob({
      postId: 'cp_1',
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'publish:cp_1:ig_123',
      content,
    });

    const attempt = await recordPublishAttempt({
      jobId: job.id,
      provider: 'dry_run',
      status: 'failed',
      request: { accessToken: 'secret-token', nested: { api_key: 'secret-key' } },
      response: { authorization: 'Bearer secret-token', ok: false },
      error: { code: 'provider_rate_limited', message: 'Rate limited', retryable: true },
      durationMs: 12,
    });

    expect(attempt.attemptNumber).toBe(1);
    expect(attempt.request).toMatchObject({ accessToken: '[redacted]', nested: { api_key: '[redacted]' } });
    expect(attempt.response).toMatchObject({ authorization: '[redacted]', ok: false });
    await expect(getPublishJob(job.id)).resolves.toMatchObject({ attemptCount: 1 });
  });

  it('trace les transitions et publications finales', async () => {
    const account = await upsertSocialAccount({
      provider: 'dry_run',
      platform: 'instagram',
      remoteId: 'ig_123',
      name: 'IG test',
    });
    const job = await createPublishJob({
      postId: 'cp_1',
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'publish:cp_1:ig_123',
      content,
      requestedBy: 'adm_1',
    });

    const publishedAt = new Date('2026-05-19T12:00:00Z');
    await updatePublishJobStatus({ jobId: job.id, status: 'publishing', lockedAt: publishedAt });
    await createPublication({
      jobId: job.id,
      postId: 'cp_1',
      accountId: account.id,
      provider: 'dry_run',
      platform: 'instagram',
      remoteId: 'dry_123',
      permalink: 'https://femiglow.test/social/dry_123',
      publishedAt,
      metadata: { access_token: 'secret' },
    });
    await updatePublishJobStatus({ jobId: job.id, status: 'published', publishedAt });

    await expect(listPublicationsForPost('cp_1')).resolves.toMatchObject([
      { remoteId: 'dry_123', metadata: { access_token: '[redacted]' } },
    ]);
    const events = await listPublishEvents(job.id);
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['job.created', 'job.publishing', 'publication.created', 'job.published']),
    );
  });
});
