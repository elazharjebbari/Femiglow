import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'admin-1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const publishContentPostNow = vi.fn();
vi.mock('@/lib/social-publishing/admin-service', () => ({
  publishContentPostNow: (...args: unknown[]) => publishContentPostNow(...args),
}));

import { POST } from '@/app/api/admin/content-studio/posts/[id]/publish-now/route';

function req(body: unknown = {}): Request {
  return new Request('http://test.local/api/admin/content-studio/posts/post_1/publish-now', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /posts/:id/publish-now — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishContentPostNow.mockResolvedValue({
      status: 'queued',
      jobs: [{ id: 'job_1', postId: 'post_1', status: 'queued' }],
    });
  });

  it('returns 201 with jobs on success', async () => {
    const res = await POST(req({}), { params: { id: 'post_1' } });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.jobs.length).toBe(1);
  });

  it('forwards postId from path', async () => {
    await POST(req({}), { params: { id: 'p_xyz' } });
    const call = publishContentPostNow.mock.calls[0]?.[0];
    expect((call as { postId: string }).postId).toBe('p_xyz');
  });

  it('accepts accountId in body', async () => {
    await POST(req({ accountId: 'acc_1' }), { params: { id: 'post_1' } });
    const call = publishContentPostNow.mock.calls[0]?.[0];
    expect((call as { accountId?: string }).accountId).toBe('acc_1');
  });

  it('accepts idempotencyKey in body', async () => {
    await POST(req({ idempotencyKey: 'idem_1' }), { params: { id: 'post_1' } });
    const call = publishContentPostNow.mock.calls[0]?.[0];
    expect((call as { idempotencyKey?: string }).idempotencyKey).toBe('idem_1');
  });

  it('falls back to Idempotency-Key header when body has none', async () => {
    const r = new Request('http://test.local/api/admin/content-studio/posts/post_1/publish-now', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'hdr_idem' },
      body: JSON.stringify({}),
    });
    await POST(r, { params: { id: 'post_1' } });
    const call = publishContentPostNow.mock.calls[0]?.[0];
    expect((call as { idempotencyKey?: string }).idempotencyKey).toBe('hdr_idem');
  });

  it('returns 500 when service throws', async () => {
    publishContentPostNow.mockRejectedValueOnce(new Error('no_account_connected'));
    const res = await POST(req(), { params: { id: 'post_1' } });
    expect(res.status).toBe(500);
  });
});
