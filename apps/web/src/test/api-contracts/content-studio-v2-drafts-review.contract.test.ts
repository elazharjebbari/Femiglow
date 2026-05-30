import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'admin-1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const reviewContentDraft = vi.fn();
vi.mock('@/lib/content-studio/service', () => ({
  reviewContentDraft: (...args: unknown[]) => reviewContentDraft(...args),
}));

import { POST } from '@/app/api/admin/content-studio/drafts/[id]/review/route';

function req(): Request {
  return new Request('http://test.local/api/admin/content-studio/drafts/draft_1/review', {
    method: 'POST',
  });
}

describe('POST /api/admin/content-studio/drafts/:id/review — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewContentDraft.mockResolvedValue({
      id: 'review_1',
      draftId: 'draft_1',
      status: 'pass',
      scoreTotal: 88,
      violations: [],
    });
  });

  it('returns 200 with review object', async () => {
    const res = await POST(req(), { params: { id: 'draft_1' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.review.draftId).toBe('draft_1');
  });

  it('passes draftId from params', async () => {
    await POST(req(), { params: { id: 'some_draft' } });
    const call = reviewContentDraft.mock.calls[0]?.[0];
    expect((call as { draftId: string }).draftId).toBe('some_draft');
  });

  it('500 when service throws', async () => {
    reviewContentDraft.mockRejectedValueOnce(new Error('boom'));
    const res = await POST(req(), { params: { id: 'draft_1' } });
    expect(res.status).toBe(500);
  });

  it('idempotent (multiple calls return ok)', async () => {
    const a = await POST(req(), { params: { id: 'draft_1' } });
    const b = await POST(req(), { params: { id: 'draft_1' } });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(reviewContentDraft).toHaveBeenCalledTimes(2);
  });
});
