import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpError } from '@/lib/errors/http-error';

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'a1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const retryPublishJob = vi.fn();
vi.mock('@/lib/social-publishing/admin-service', () => ({
  retryPublishJob: (...args: unknown[]) => retryPublishJob(...args),
}));

import { POST } from '@/app/api/admin/content-studio/publish-jobs/[id]/retry/route';

function req(): Request {
  return new Request('http://test.local/api/admin/content-studio/publish-jobs/spj_1/retry', {
    method: 'POST',
  });
}

describe('POST /publish-jobs/:id/retry — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    retryPublishJob.mockResolvedValue({
      job: { id: 'spj_1', status: 'queued' },
    });
  });

  it('returns 200 happy path', async () => {
    const res = await POST(req(), { params: { id: 'spj_1' } });
    expect(res.status).toBe(200);
  });

  it('forwards jobId from path', async () => {
    await POST(req(), { params: { id: 'spj_xyz' } });
    const call = retryPublishJob.mock.calls[0]?.[0];
    expect((call as { jobId: string }).jobId).toBe('spj_xyz');
  });

  it('forwards actorId from session', async () => {
    await POST(req(), { params: { id: 'spj_1' } });
    const call = retryPublishJob.mock.calls[0]?.[0];
    expect((call as { actorId: string }).actorId).toBe('a1');
  });

  it('returns 409 when service throws invalid_state', async () => {
    retryPublishJob.mockRejectedValueOnce(new HttpError('invalid_state', 'Not failed'));
    const res = await POST(req(), { params: { id: 'spj_1' } });
    expect(res.status).toBe(409);
  });

  it('returns 404 when job not found', async () => {
    retryPublishJob.mockRejectedValueOnce(new HttpError('not_found', 'Job not found'));
    const res = await POST(req(), { params: { id: 'spj_1' } });
    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected error', async () => {
    retryPublishJob.mockRejectedValueOnce(new Error('boom'));
    const res = await POST(req(), { params: { id: 'spj_1' } });
    expect(res.status).toBe(500);
  });
});
