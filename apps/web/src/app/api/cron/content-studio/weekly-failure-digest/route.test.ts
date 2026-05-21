import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/lib/env';
import { resetMemoryStore } from '@/lib/db/client';
import { createPublishJob, updatePublishJobStatus } from '@/lib/social-publishing/repository';

import { GET } from './route';

const ORIGINAL_CRON_SECRET = (env as unknown as Record<string, unknown>).CRON_SECRET;

function authed(): Request {
  return new Request('http://localhost/api/cron/content-studio/weekly-failure-digest', {
    method: 'GET',
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  });
}

describe('GET /api/cron/content-studio/weekly-failure-digest', () => {
  beforeEach(() => {
    resetMemoryStore();
    (env as unknown as Record<string, unknown>).CRON_SECRET = 'test-secret';
  });

  afterEach(() => {
    (env as unknown as Record<string, unknown>).CRON_SECRET = ORIGINAL_CRON_SECRET;
    (env as unknown as Record<string, unknown>).SOCIAL_DIGEST_RECIPIENT = undefined;
    (env as unknown as Record<string, unknown>).CHAT_DIGEST_RECIPIENT = undefined;
  });

  it('renvoie 401 sans Bearer', async () => {
    const res = await GET(new Request('http://localhost/api/cron/content-studio/weekly-failure-digest', { method: 'GET' }));
    expect(res.status).toBe(401);
  });

  it('renvoie 200 + skipped quand pas de destinataire', async () => {
    const res = await GET(authed());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; skipped?: boolean };
    expect(body).toMatchObject({ ok: true, skipped: true });
  });

  it('envoie le digest et renvoie total=0 quand aucune erreur', async () => {
    (env as unknown as Record<string, unknown>).SOCIAL_DIGEST_RECIPIENT = 'ops@femiglow.local';
    const res = await GET(authed());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; total: number; provider: string };
    expect(body.ok).toBe(true);
    expect(body.total).toBe(0);
    expect(body.provider).toBeTruthy();
  });

  it('comptabilise un échec présent en mémoire', async () => {
    (env as unknown as Record<string, unknown>).SOCIAL_DIGEST_RECIPIENT = 'ops@femiglow.local';
    const job = await createPublishJob({
      postId: 'post_smoke',
      accountId: 'acct_smoke',
      provider: 'postiz',
      platform: 'instagram',
      format: 'post',
      idempotencyKey: 'idem_smoke',
      content: { sourcePostId: 'post_smoke', platform: 'instagram', format: 'post', caption: '', media: [] },
      status: 'queued',
      requestedBy: null,
    });
    await updatePublishJobStatus({
      jobId: job.id,
      status: 'failed',
      lastError: { code: 'provider_unavailable', message: '503', retryable: true },
    });
    const res = await GET(authed());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; total: number };
    expect(body.total).toBe(1);
  });
});
