import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpError } from '@/lib/errors/http-error';

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'a1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const reschedulePost = vi.fn();
vi.mock('@/lib/content-studio/service', () => ({
  reschedulePost: (...args: unknown[]) => reschedulePost(...args),
}));

import { PATCH } from '@/app/api/admin/content-studio/posts/[id]/reschedule/route';

const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function req(body: unknown): Request {
  return new Request('http://test.local/api/admin/content-studio/posts/post_1/reschedule', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /posts/:id/reschedule — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reschedulePost.mockResolvedValue({
      id: 'post_1',
      status: 'scheduled',
      scheduledAt: futureIso,
    });
  });

  it('returns 200 happy path', async () => {
    const res = await PATCH(req({ scheduledAt: futureIso }), { params: { id: 'post_1' } });
    expect(res.status).toBe(200);
  });

  it('forwards scheduledAt to service', async () => {
    await PATCH(req({ scheduledAt: futureIso }), { params: { id: 'post_1' } });
    const call = reschedulePost.mock.calls[0]?.[0];
    expect((call as { scheduledAt: string }).scheduledAt).toBe(futureIso);
  });

  it('returns 400 on missing scheduledAt', async () => {
    const res = await PATCH(req({}), { params: { id: 'post_1' } });
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid date format', async () => {
    const res = await PATCH(req({ scheduledAt: 'tomorrow' }), { params: { id: 'post_1' } });
    expect(res.status).toBe(400);
  });

  it('returns 409 when service throws invalid_state', async () => {
    reschedulePost.mockRejectedValueOnce(new HttpError('invalid_state', 'Not scheduled'));
    const res = await PATCH(req({ scheduledAt: futureIso }), { params: { id: 'post_1' } });
    expect(res.status).toBe(409);
  });

  it('forwards postId from path', async () => {
    await PATCH(req({ scheduledAt: futureIso }), { params: { id: 'p_xyz' } });
    const call = reschedulePost.mock.calls[0]?.[0];
    expect((call as { postId: string }).postId).toBe('p_xyz');
  });

  it('returns 500 on unexpected error', async () => {
    reschedulePost.mockRejectedValueOnce(new Error('boom'));
    const res = await PATCH(req({ scheduledAt: futureIso }), { params: { id: 'post_1' } });
    expect(res.status).toBe(500);
  });
});
