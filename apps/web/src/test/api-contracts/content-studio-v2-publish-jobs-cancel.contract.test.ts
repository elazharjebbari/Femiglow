import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpError } from '@/lib/errors/http-error';

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'a1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const cancelPublishJob = vi.fn();
vi.mock('@/lib/social-publishing/admin-service', () => ({
  cancelPublishJob: (...args: unknown[]) => cancelPublishJob(...args),
}));

import { POST } from '@/app/api/admin/content-studio/publish-jobs/[id]/cancel/route';

function req(): Request {
  return new Request('http://test.local/api/admin/content-studio/publish-jobs/spj_1/cancel', {
    method: 'POST',
  });
}

describe('POST /publish-jobs/:id/cancel — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancelPublishJob.mockResolvedValue({
      job: { id: 'spj_1', status: 'cancelled' },
    });
  });

  it('returns 200 happy path', async () => {
    const res = await POST(req(), { params: { id: 'spj_1' } });
    expect(res.status).toBe(200);
  });

  it('forwards jobId from path', async () => {
    await POST(req(), { params: { id: 'spj_xyz' } });
    const call = cancelPublishJob.mock.calls[0]?.[0];
    expect((call as { jobId: string }).jobId).toBe('spj_xyz');
  });

  it('forwards actorId from session', async () => {
    await POST(req(), { params: { id: 'spj_1' } });
    const call = cancelPublishJob.mock.calls[0]?.[0];
    expect((call as { actorId: string }).actorId).toBe('a1');
  });

  it('returns 409 when job already terminal', async () => {
    cancelPublishJob.mockRejectedValueOnce(
      new HttpError('invalid_state', 'Already terminal'),
    );
    const res = await POST(req(), { params: { id: 'spj_1' } });
    expect(res.status).toBe(409);
  });

  it('returns 500 on unexpected error', async () => {
    cancelPublishJob.mockRejectedValueOnce(new Error('boom'));
    const res = await POST(req(), { params: { id: 'spj_1' } });
    expect(res.status).toBe(500);
  });

  it('returns 200 with cancelled job in response', async () => {
    const res = await POST(req(), { params: { id: 'spj_1' } });
    const json = await res.json();
    expect(json.job.status).toBe('cancelled');
  });
});
