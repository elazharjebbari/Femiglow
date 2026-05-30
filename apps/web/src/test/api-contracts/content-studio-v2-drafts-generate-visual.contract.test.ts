import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'admin-1', email: 'a@t' }),
  requireContentStudioEnabled: vi.fn(),
}));

const generateVisualForDraft = vi.fn();
vi.mock('@/lib/content-studio/service', () => ({
  generateVisualForDraft: (...args: unknown[]) => generateVisualForDraft(...args),
}));

import { POST } from '@/app/api/admin/content-studio/drafts/[id]/generate-visual/route';

function req(body: unknown): Request {
  return new Request('http://test.local/api/admin/content-studio/drafts/draft_1/generate-visual', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validImageBody = {
  prompt: 'Visuel skincare slow living lumière chaude',
  size: '1024x1536',
  quality: 'low',
};

describe('POST /drafts/:id/generate-visual — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateVisualForDraft.mockResolvedValue({
      id: 'media_1',
      kind: 'image',
      compartment: 'ai_generated',
      previewUrl: '/m/p.png',
    });
  });

  it('returns 200 for valid image payload', async () => {
    const res = await POST(req(validImageBody), { params: { id: 'draft_1' } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.media.id).toBe('media_1');
  });

  it('returns 400 when prompt is too short (< 12 chars)', async () => {
    const res = await POST(req({ ...validImageBody, prompt: 'short' }), {
      params: { id: 'draft_1' },
    });
    expect(res.status).toBe(400);
  });

  it('accepts kind=video (CS v2 Phase 3)', async () => {
    generateVisualForDraft.mockResolvedValueOnce({
      id: 'media_v',
      kind: 'video',
      compartment: 'ai_generated',
      originalUrl: '/m/reel.mp4',
    });
    const res = await POST(req({ ...validImageBody, kind: 'video' }), {
      params: { id: 'draft_1' },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.media.kind).toBe('video');
    const call = generateVisualForDraft.mock.calls[0]?.[0];
    expect((call as { kind?: string }).kind).toBe('video');
  });

  it('defaults kind to "image" when omitted', async () => {
    await POST(req(validImageBody), { params: { id: 'draft_1' } });
    const call = generateVisualForDraft.mock.calls[0]?.[0];
    expect((call as { kind?: string }).kind).toBe('image');
  });

  it('forwards model when provided', async () => {
    await POST(req({ ...validImageBody, model: 'dall-e-3' }), {
      params: { id: 'draft_1' },
    });
    const call = generateVisualForDraft.mock.calls[0]?.[0];
    expect((call as { model?: string }).model).toBe('dall-e-3');
  });

  it('returns 400 on invalid kind value', async () => {
    const res = await POST(req({ ...validImageBody, kind: 'nope' }), {
      params: { id: 'draft_1' },
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid size value', async () => {
    const res = await POST(req({ ...validImageBody, size: '999x999' }), {
      params: { id: 'draft_1' },
    });
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws', async () => {
    generateVisualForDraft.mockRejectedValueOnce(new Error('provider down'));
    const res = await POST(req(validImageBody), { params: { id: 'draft_1' } });
    expect(res.status).toBe(500);
  });
});
