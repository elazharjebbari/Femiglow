import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpError } from '@/lib/errors/http-error';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'admin-1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const approveContentDraft = vi.fn();
vi.mock('@/lib/content-studio/service', () => ({
  approveContentDraft: (...args: unknown[]) => approveContentDraft(...args),
}));

import { POST } from '@/app/api/admin/content-studio/drafts/[id]/approve/route';

function req(): Request {
  return new Request('http://test.local/api/admin/content-studio/drafts/draft_1/approve', {
    method: 'POST',
  });
}

describe('POST /api/admin/content-studio/drafts/:id/approve — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    approveContentDraft.mockResolvedValue({
      id: 'post_1',
      draftId: 'draft_1',
      status: 'approved',
    });
  });

  it('returns 200 with post object on success', async () => {
    const res = await POST(req(), { params: { id: 'draft_1' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.post.id).toBe('post_1');
    expect(json.post.draftId).toBe('draft_1');
  });

  it('forwards draftId from params', async () => {
    await POST(req(), { params: { id: 'my_draft' } });
    const call = approveContentDraft.mock.calls[0]?.[0];
    expect((call as { draftId: string }).draftId).toBe('my_draft');
  });

  it('forwards actorId from session', async () => {
    await POST(req(), { params: { id: 'draft_1' } });
    const call = approveContentDraft.mock.calls[0]?.[0];
    expect((call as { actorId: string }).actorId).toBe('admin-1');
  });

  it('returns 409 (invalid_state) when service throws invalid_state HttpError', async () => {
    approveContentDraft.mockRejectedValueOnce(
      new HttpError('invalid_state', 'Media manquant', { code: 'no_media_attached' }),
    );
    const res = await POST(req(), { params: { id: 'draft_1' } });
    expect(res.status).toBe(409);
  });

  it('returns 500 on unexpected error', async () => {
    approveContentDraft.mockRejectedValueOnce(new Error('boom'));
    const res = await POST(req(), { params: { id: 'draft_1' } });
    expect(res.status).toBe(500);
  });
});
