import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'a1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const sendContentPostToDraft = vi.fn();
vi.mock('@/lib/social-publishing/admin-service', () => ({
  sendContentPostToDraft: (...args: unknown[]) => sendContentPostToDraft(...args),
}));

import { POST } from '@/app/api/admin/content-studio/posts/[id]/draft-on-provider/route';

function req(body: unknown = {}): Request {
  return new Request('http://test.local/api/admin/content-studio/posts/post_1/draft-on-provider', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /posts/:id/draft-on-provider — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendContentPostToDraft.mockResolvedValue({
      status: 'approved',
      jobs: [{ id: 'spj_d', publishMode: 'draft' }],
    });
  });

  it('returns 201 happy path', async () => {
    const res = await POST(req({}), { params: { id: 'post_1' } });
    expect(res.status).toBe(201);
  });

  it('forwards postId from path', async () => {
    await POST(req({}), { params: { id: 'p_xyz' } });
    const call = sendContentPostToDraft.mock.calls[0]?.[0];
    expect((call as { postId: string }).postId).toBe('p_xyz');
  });

  it('forwards actorId from session', async () => {
    await POST(req({}), { params: { id: 'post_1' } });
    const call = sendContentPostToDraft.mock.calls[0]?.[0];
    expect((call as { actorId: string }).actorId).toBe('a1');
  });

  it('accepts accountId in body', async () => {
    await POST(req({ accountId: 'acc_1' }), { params: { id: 'post_1' } });
    const call = sendContentPostToDraft.mock.calls[0]?.[0];
    expect((call as { accountId?: string }).accountId).toBe('acc_1');
  });

  it('accepts idempotencyKey in body', async () => {
    await POST(req({ idempotencyKey: 'idem_1' }), { params: { id: 'post_1' } });
    const call = sendContentPostToDraft.mock.calls[0]?.[0];
    expect((call as { idempotencyKey?: string }).idempotencyKey).toBe('idem_1');
  });

  it('falls back to Idempotency-Key header', async () => {
    const r = new Request('http://test.local/api/admin/content-studio/posts/post_1/draft-on-provider', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'hdr_1' },
      body: JSON.stringify({}),
    });
    await POST(r, { params: { id: 'post_1' } });
    const call = sendContentPostToDraft.mock.calls[0]?.[0];
    expect((call as { idempotencyKey?: string }).idempotencyKey).toBe('hdr_1');
  });

  it('returns 500 when service throws', async () => {
    sendContentPostToDraft.mockRejectedValueOnce(new Error('boom'));
    const res = await POST(req({}), { params: { id: 'post_1' } });
    expect(res.status).toBe(500);
  });
});
