import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'admin-1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const updateContentDraft = vi.fn();
vi.mock('@/lib/content-studio/service', () => ({
  updateContentDraft: (...args: unknown[]) => updateContentDraft(...args),
}));

import { PATCH } from '@/app/api/admin/content-studio/drafts/[id]/route';

function req(body: unknown): Request {
  return new Request('http://test.local/api/admin/content-studio/drafts/draft_1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /drafts/:id — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateContentDraft.mockResolvedValue({
      id: 'draft_1',
      caption: 'updated',
      status: 'needs_review',
    });
  });

  it('returns 200 with updated draft', async () => {
    const res = await PATCH(req({ caption: 'updated caption text' }), {
      params: { id: 'draft_1' },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.draft.id).toBe('draft_1');
  });

  it('forwards patch fields to service', async () => {
    await PATCH(
      req({ caption: 'new', hook: 'new hook', hashtags: ['#a', '#b'] }),
      { params: { id: 'draft_1' } },
    );
    const call = updateContentDraft.mock.calls[0]?.[0];
    expect((call as { patch: { caption: string } }).patch.caption).toBe('new');
    expect((call as { patch: { hashtags: string[] } }).patch.hashtags).toEqual(['#a', '#b']);
  });

  it('returns 400 on caption too long (> 2200 chars)', async () => {
    const res = await PATCH(req({ caption: 'x'.repeat(2201) }), {
      params: { id: 'draft_1' },
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 on hashtags > 30 items', async () => {
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`);
    const res = await PATCH(req({ hashtags: tags }), { params: { id: 'draft_1' } });
    expect(res.status).toBe(400);
  });

  it('accepts mediaId null (to detach)', async () => {
    const res = await PATCH(req({ mediaId: null }), { params: { id: 'draft_1' } });
    expect(res.status).toBe(200);
  });

  it('returns 400 on unknown field (strict schema)', async () => {
    const res = await PATCH(req({ random: 'x' }), { params: { id: 'draft_1' } });
    expect(res.status).toBe(400);
  });
});
