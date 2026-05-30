import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpError } from '@/lib/errors/http-error';

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'a1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const cancelScheduledPost = vi.fn();
vi.mock('@/lib/content-studio/service', () => ({
  cancelScheduledPost: (...args: unknown[]) => cancelScheduledPost(...args),
}));

import { POST } from '@/app/api/admin/content-studio/posts/[id]/cancel/route';

function req(body: unknown = {}): Request {
  return new Request('http://test.local/api/admin/content-studio/posts/post_1/cancel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /posts/:id/cancel — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancelScheduledPost.mockResolvedValue({
      id: 'post_1',
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });
  });

  it('returns 200 happy path', async () => {
    const res = await POST(req({}), { params: { id: 'post_1' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.post.status).toBe('cancelled');
  });

  it('forwards reason in body', async () => {
    await POST(req({ reason: 'Plus pertinent' }), { params: { id: 'post_1' } });
    const call = cancelScheduledPost.mock.calls[0]?.[0];
    expect((call as { reason: string }).reason).toBe('Plus pertinent');
  });

  it('returns 400 on invalid input (too long reason)', async () => {
    const longReason = 'x'.repeat(600);
    const res = await POST(req({ reason: longReason }), { params: { id: 'post_1' } });
    expect(res.status).toBe(400);
  });

  it('forwards postId from path', async () => {
    await POST(req({}), { params: { id: 'p_xyz' } });
    const call = cancelScheduledPost.mock.calls[0]?.[0];
    expect((call as { postId: string }).postId).toBe('p_xyz');
  });

  it('returns 409 when service throws invalid_state', async () => {
    cancelScheduledPost.mockRejectedValueOnce(
      new HttpError('invalid_state', 'Already terminal'),
    );
    const res = await POST(req({}), { params: { id: 'post_1' } });
    expect(res.status).toBe(409);
  });

  it('returns 500 on unexpected error', async () => {
    cancelScheduledPost.mockRejectedValueOnce(new Error('boom'));
    const res = await POST(req({}), { params: { id: 'post_1' } });
    expect(res.status).toBe(500);
  });
});
