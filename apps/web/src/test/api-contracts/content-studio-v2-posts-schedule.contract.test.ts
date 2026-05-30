import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'admin-1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const scheduleContentPost = vi.fn();
vi.mock('@/lib/social-publishing/admin-service', () => ({
  scheduleContentPost: (...args: unknown[]) => scheduleContentPost(...args),
}));

import { POST } from '@/app/api/admin/content-studio/posts/[id]/schedule/route';

function req(body: unknown): Request {
  return new Request('http://test.local/api/admin/content-studio/posts/post_1/schedule', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe('POST /posts/:id/schedule — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduleContentPost.mockResolvedValue({
      status: 'scheduled',
      jobs: [{ id: 'j1', postId: 'post_1', status: 'queued', scheduledAt: futureIso }],
    });
  });

  it('returns 201 for a valid future scheduledAt', async () => {
    const res = await POST(req({ scheduledAt: futureIso }), { params: { id: 'post_1' } });
    expect(res.status).toBe(201);
  });

  it('returns 400 when scheduledAt is missing', async () => {
    const res = await POST(req({}), { params: { id: 'post_1' } });
    expect(res.status).toBe(400);
  });

  it('returns 400 when scheduledAt is not a valid ISO datetime', async () => {
    const res = await POST(req({ scheduledAt: 'tomorrow' }), { params: { id: 'post_1' } });
    expect(res.status).toBe(400);
  });

  it('parses scheduledAt as Date when passing to service', async () => {
    await POST(req({ scheduledAt: futureIso }), { params: { id: 'post_1' } });
    const call = scheduleContentPost.mock.calls[0]?.[0];
    expect((call as { scheduledAt: Date }).scheduledAt).toBeInstanceOf(Date);
  });

  it('accepts optional accountId', async () => {
    await POST(req({ scheduledAt: futureIso, accountId: 'acc_X' }), {
      params: { id: 'post_1' },
    });
    const call = scheduleContentPost.mock.calls[0]?.[0];
    expect((call as { accountId?: string }).accountId).toBe('acc_X');
  });

  it('returns 500 when service throws', async () => {
    scheduleContentPost.mockRejectedValueOnce(new Error('boom'));
    const res = await POST(req({ scheduledAt: futureIso }), { params: { id: 'post_1' } });
    expect(res.status).toBe(500);
  });
});
