/**
 * Smoke test for the publish admin handlers catalog.
 * Validates that each variant returns the expected HTTP code + shape.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import {
  createPublishHandlers,
  resetPublishMockStore,
  getPublishMockStore,
} from './content-studio-publish-handlers';
import { jobFailedRateLimit, jobQueuedNow } from '@/test/fixtures/social-publishing';

const BASE = 'http://test.local';

function makeServer(...args: Parameters<typeof createPublishHandlers>) {
  const server = setupServer(...createPublishHandlers(...args));
  server.listen({ onUnhandledRequest: 'bypass' });
  return server;
}

describe('content-studio-publish-handlers — smoke', () => {
  beforeEach(() => {
    resetPublishMockStore();
  });

  it('health returns mockMode', async () => {
    const server = makeServer({ mockMode: true });
    const res = await fetch(`${BASE}/api/admin/content-studio/health`);
    const json = (await res.json()) as { mockMode: boolean };
    expect(res.status).toBe(200);
    expect(json.mockMode).toBe(true);
    server.close();
  });

  it('publish-now success creates job with idempotency', async () => {
    const server = makeServer();
    const res = await fetch(`${BASE}/api/admin/content-studio/posts/post_1/publish-now`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: 'k1' }),
    });
    const json = (await res.json()) as { jobs: Array<{ id: string; postId: string }> };
    expect(res.status).toBe(201);
    expect(json.jobs[0]!.postId).toBe('post_1');
    expect(getPublishMockStore().calls.publishNow).toBe(1);
    server.close();
  });

  it('publish-now idempotency replay returns same job id', async () => {
    const server = makeServer();
    const first = await fetch(`${BASE}/api/admin/content-studio/posts/post_1/publish-now`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: 'k1' }),
    });
    const j1 = (await first.json()) as { jobs: Array<{ id: string }> };
    const second = await fetch(`${BASE}/api/admin/content-studio/posts/post_1/publish-now`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: 'k1' }),
    });
    const j2 = (await second.json()) as { jobs: Array<{ id: string }> };
    expect(j1.jobs[0]!.id).toBe(j2.jobs[0]!.id);
    server.close();
  });

  it('publish-now rate_limited returns 429', async () => {
    const server = makeServer({ publishNow: 'rate_limited' });
    const res = await fetch(`${BASE}/api/admin/content-studio/posts/post_1/publish-now`, {
      method: 'POST',
      body: '{}',
    });
    expect(res.status).toBe(429);
    server.close();
  });

  it('publish-now brand_blocked returns 409 with code', async () => {
    const server = makeServer({ publishNow: 'brand_blocked' });
    const res = await fetch(`${BASE}/api/admin/content-studio/posts/post_1/publish-now`, {
      method: 'POST',
      body: '{}',
    });
    const json = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(409);
    expect(json.error.code).toBe('brand_review_blocked');
    server.close();
  });

  it('schedule success requires scheduledAt', async () => {
    const server = makeServer();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await fetch(`${BASE}/api/admin/content-studio/posts/post_1/schedule`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scheduledAt: future }),
    });
    expect(res.status).toBe(201);
    server.close();
  });

  it('schedule rejects missing scheduledAt', async () => {
    const server = makeServer();
    const res = await fetch(`${BASE}/api/admin/content-studio/posts/post_1/schedule`, {
      method: 'POST',
      body: '{}',
    });
    expect(res.status).toBe(400);
    server.close();
  });

  it('schedule past_date returns 400', async () => {
    const server = makeServer({ schedule: 'past_date' });
    const res = await fetch(`${BASE}/api/admin/content-studio/posts/post_1/schedule`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scheduledAt: '2020-01-01T00:00:00Z' }),
    });
    const json = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(400);
    expect(json.error.code).toBe('invalid_date');
    server.close();
  });

  it('draft success creates draft mode job', async () => {
    const server = makeServer();
    const res = await fetch(`${BASE}/api/admin/content-studio/posts/post_1/draft-on-provider`, {
      method: 'POST',
      body: '{}',
    });
    const json = (await res.json()) as {
      status: string;
      jobs: Array<{ content: { publishMode: string } }>;
    };
    expect(res.status).toBe(201);
    expect(json.status).toBe('approved');
    expect(json.jobs[0]!.content.publishMode).toBe('draft');
    server.close();
  });

  it('cancel success returns post cancelled', async () => {
    const server = makeServer();
    const res = await fetch(`${BASE}/api/admin/content-studio/posts/post_1/cancel`, {
      method: 'POST',
      body: '{}',
    });
    const json = (await res.json()) as { post: { status: string } };
    expect(res.status).toBe(200);
    expect(json.post.status).toBe('cancelled');
    server.close();
  });

  it('reschedule success returns updated post', async () => {
    const server = makeServer();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(`${BASE}/api/admin/content-studio/posts/post_1/reschedule`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scheduledAt: future }),
    });
    expect(res.status).toBe(200);
    server.close();
  });

  it('jobs list returns seeded jobs', async () => {
    const server = makeServer({ initialJobs: [jobQueuedNow, jobFailedRateLimit] });
    const res = await fetch(`${BASE}/api/admin/content-studio/publish-jobs`);
    const json = (await res.json()) as { jobs: unknown[]; count: number };
    expect(res.status).toBe(200);
    expect(json.count).toBe(2);
    server.close();
  });

  it('jobs list filter by status', async () => {
    const server = makeServer({ initialJobs: [jobQueuedNow, jobFailedRateLimit] });
    const res = await fetch(`${BASE}/api/admin/content-studio/publish-jobs?status=failed`);
    const json = (await res.json()) as { jobs: Array<{ id: string }>; count: number };
    expect(json.count).toBe(1);
    expect(json.jobs[0]!.id).toBe('spj_e2e_5');
    server.close();
  });

  it('job retry returns updated job', async () => {
    const server = makeServer({ initialJobs: [jobFailedRateLimit] });
    const res = await fetch(
      `${BASE}/api/admin/content-studio/publish-jobs/${jobFailedRateLimit.id}/retry`,
      { method: 'POST' },
    );
    const json = (await res.json()) as { job: { status: string } };
    expect(res.status).toBe(200);
    expect(json.job.status).toBe('queued');
    server.close();
  });

  it('job cancel returns cancelled', async () => {
    const server = makeServer({ initialJobs: [jobQueuedNow] });
    const res = await fetch(
      `${BASE}/api/admin/content-studio/publish-jobs/${jobQueuedNow.id}/cancel`,
      { method: 'POST' },
    );
    const json = (await res.json()) as { job: { status: string } };
    expect(json.job.status).toBe('cancelled');
    server.close();
  });

  it('postiz sync returns accounts', async () => {
    const server = makeServer();
    const res = await fetch(
      `${BASE}/api/admin/content-studio/postiz/integrations/sync`,
      { method: 'POST' },
    );
    const json = (await res.json()) as { summary: { total: number } };
    expect(res.status).toBe(200);
    expect(json.summary.total).toBeGreaterThanOrEqual(0);
    server.close();
  });

  it('postiz sync unauthorized', async () => {
    const server = makeServer({ postizSync: 'unauthorized' });
    const res = await fetch(
      `${BASE}/api/admin/content-studio/postiz/integrations/sync`,
      { method: 'POST' },
    );
    expect(res.status).toBe(401);
    server.close();
  });

  it('store records call counts', async () => {
    const server = makeServer();
    await fetch(`${BASE}/api/admin/content-studio/posts/p1/publish-now`, { method: 'POST', body: '{}' });
    await fetch(`${BASE}/api/admin/content-studio/posts/p1/cancel`, { method: 'POST', body: '{}' });
    expect(getPublishMockStore().calls.publishNow).toBe(1);
    expect(getPublishMockStore().calls.cancel).toBe(1);
    server.close();
  });

  it('budget remaining override', async () => {
    const server = makeServer({ budgetRemainingCents: 5 });
    const res = await fetch(`${BASE}/api/admin/content-studio/generation-runs`);
    const json = (await res.json()) as { budget: { remainingCents: number } };
    expect(json.budget.remainingCents).toBe(5);
    server.close();
  });
});
