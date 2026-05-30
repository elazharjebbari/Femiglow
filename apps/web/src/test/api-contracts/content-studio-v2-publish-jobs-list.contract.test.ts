import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({ get: vi.fn() })) }));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'a1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const listPublishJobsForAdmin = vi.fn();
vi.mock('@/lib/social-publishing/admin-service', () => ({
  listPublishJobsForAdmin: (...args: unknown[]) => listPublishJobsForAdmin(...args),
}));

import { GET } from '@/app/api/admin/content-studio/publish-jobs/route';

function req(qs = ''): Request {
  return new Request(`http://test.local/api/admin/content-studio/publish-jobs${qs ? `?${qs}` : ''}`);
}

describe('GET /publish-jobs — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPublishJobsForAdmin.mockResolvedValue([
      { id: 'spj_1', status: 'queued' },
      { id: 'spj_2', status: 'failed' },
    ]);
  });

  it('returns 200 with jobs', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.jobs.length).toBe(2);
  });

  it('filters by status query', async () => {
    await GET(req('status=failed'));
    const call = listPublishJobsForAdmin.mock.calls[0]?.[0];
    expect((call as { status?: string }).status).toBe('failed');
  });

  it('filters by accountId', async () => {
    await GET(req('accountId=acc_1'));
    const call = listPublishJobsForAdmin.mock.calls[0]?.[0];
    expect((call as { accountId?: string }).accountId).toBe('acc_1');
  });

  it('filters by postId', async () => {
    await GET(req('postId=p1'));
    const call = listPublishJobsForAdmin.mock.calls[0]?.[0];
    expect((call as { postId?: string }).postId).toBe('p1');
  });

  it('rejects invalid status enum', async () => {
    const res = await GET(req('status=hacked'));
    expect(res.status).toBe(400);
  });

  it('returns 500 on service error', async () => {
    listPublishJobsForAdmin.mockRejectedValueOnce(new Error('boom'));
    const res = await GET(req());
    expect(res.status).toBe(500);
  });
});
