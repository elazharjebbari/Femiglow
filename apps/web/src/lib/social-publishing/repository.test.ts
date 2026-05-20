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
  listScheduledJobsDue,
  listSocialAccounts,
  recordPublishAttempt,
  tryAcquirePublishJobLock,
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

  describe('tryAcquirePublishJobLock', () => {
    async function newQueuedJob(idempotencyKey: string, scheduledAt: Date | null = null) {
      const account = await upsertSocialAccount({
        provider: 'dry_run',
        platform: 'instagram',
        remoteId: 'ig_lock',
        name: 'IG lock test',
      });
      return createPublishJob({
        postId: 'cp_lock',
        accountId: account.id,
        provider: 'dry_run',
        platform: 'instagram',
        format: 'post',
        idempotencyKey,
        content,
        scheduledAt,
      });
    }

    it('acquiert un job queued non locké et le passe en publishing', async () => {
      const job = await newQueuedJob('lock:1');
      const locked = await tryAcquirePublishJobLock({ jobId: job.id, allowedFromStatuses: ['queued', 'failed'] });
      expect(locked).not.toBeNull();
      expect(locked?.status).toBe('publishing');
      expect(locked?.lockedAt).toBeInstanceOf(Date);
    });

    it('acquiert un job failed pour un retry', async () => {
      const job = await newQueuedJob('lock:2');
      await updatePublishJobStatus({ jobId: job.id, status: 'publishing' });
      await updatePublishJobStatus({ jobId: job.id, status: 'failed', lockedAt: null });
      const locked = await tryAcquirePublishJobLock({ jobId: job.id, allowedFromStatuses: ['queued', 'failed'] });
      expect(locked?.status).toBe('publishing');
    });

    it('retourne null pour un job deja en publishing', async () => {
      const job = await newQueuedJob('lock:3');
      await tryAcquirePublishJobLock({ jobId: job.id, allowedFromStatuses: ['queued', 'failed'] });
      const second = await tryAcquirePublishJobLock({ jobId: job.id, allowedFromStatuses: ['queued', 'failed'] });
      expect(second).toBeNull();
    });

    it('retourne null pour un job avec lockedAt non null meme si status autorise', async () => {
      const job = await newQueuedJob('lock:4');
      await updatePublishJobStatus({ jobId: job.id, status: 'failed', lockedAt: new Date() });
      const locked = await tryAcquirePublishJobLock({ jobId: job.id, allowedFromStatuses: ['queued', 'failed'] });
      expect(locked).toBeNull();
    });

    it('retourne null pour un job avec status hors allowedFromStatuses', async () => {
      const job = await newQueuedJob('lock:5');
      await updatePublishJobStatus({ jobId: job.id, status: 'cancelled' });
      const locked = await tryAcquirePublishJobLock({ jobId: job.id, allowedFromStatuses: ['queued', 'failed'] });
      expect(locked).toBeNull();
    });
  });

  describe('listScheduledJobsDue', () => {
    async function newJob(idempotencyKey: string, scheduledAt: Date | null) {
      const account = await upsertSocialAccount({
        provider: 'dry_run',
        platform: 'instagram',
        remoteId: 'ig_due',
        name: 'IG due test',
      });
      return createPublishJob({
        postId: 'cp_due',
        accountId: account.id,
        provider: 'dry_run',
        platform: 'instagram',
        format: 'post',
        idempotencyKey,
        content,
        scheduledAt,
      });
    }

    it('retourne les jobs queued avec scheduled_at <= now', async () => {
      const past = new Date('2026-05-19T10:00:00Z');
      const future = new Date('2026-05-22T10:00:00Z');
      await newJob('due:1', past);
      await newJob('due:2', future);
      const due = await listScheduledJobsDue({ now: new Date('2026-05-20T00:00:00Z'), limit: 10 });
      expect(due.map((j) => j.idempotencyKey)).toEqual(['due:1']);
    });

    it('ignore les jobs sans scheduled_at (publish-now)', async () => {
      await newJob('due:3', null);
      const due = await listScheduledJobsDue({ now: new Date('2026-05-20T00:00:00Z'), limit: 10 });
      expect(due).toHaveLength(0);
    });

    it('ignore les jobs deja lockes', async () => {
      const job = await newJob('due:4', new Date('2026-05-19T10:00:00Z'));
      await tryAcquirePublishJobLock({ jobId: job.id, allowedFromStatuses: ['queued', 'failed'] });
      const due = await listScheduledJobsDue({ now: new Date('2026-05-20T00:00:00Z'), limit: 10 });
      expect(due).toHaveLength(0);
    });

    it('respecte la limite et l ordre ascendant par scheduled_at', async () => {
      await newJob('due:a', new Date('2026-05-19T08:00:00Z'));
      await newJob('due:b', new Date('2026-05-19T05:00:00Z'));
      await newJob('due:c', new Date('2026-05-19T11:00:00Z'));
      const due = await listScheduledJobsDue({ now: new Date('2026-05-20T00:00:00Z'), limit: 2 });
      expect(due.map((j) => j.idempotencyKey)).toEqual(['due:b', 'due:a']);
    });
  });
});
