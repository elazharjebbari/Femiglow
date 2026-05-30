import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (must come before the route import)
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'admin-1', email: 'admin@test' }),
  requireContentStudioEnabled: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/admin/content-studio/models/route';

function req(qs: string): Request {
  return new Request(`http://test.local/api/admin/content-studio/models?${qs}`);
}

describe('GET /api/admin/content-studio/models — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with models, suggested, providers for role=chat', async () => {
    const res = await GET(req('role=chat'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.models)).toBe(true);
    expect(json.models.length).toBeGreaterThanOrEqual(2);
    expect(json.suggested).toBeTruthy();
    expect(Array.isArray(json.providers)).toBe(true);
  });

  it('every model has role=chat when role=chat', async () => {
    const res = await GET(req('role=chat'));
    const json = await res.json();
    for (const m of json.models) {
      expect(m.role).toBe('chat');
    }
  });

  it('suggested adapts to format=reel for chat', async () => {
    const res = await GET(req('role=chat&format=reel'));
    const json = await res.json();
    expect(json.suggested.id).toBe('gpt-4o');
    expect(json.suggested.recommendedFor).toContain('reel');
  });

  it('suggested adapts to format=story for image', async () => {
    const res = await GET(req('role=image&format=story'));
    const json = await res.json();
    expect(json.suggested.id).toBe('gpt-image-1-mini');
  });

  it('returns mock video as suggested for role=video', async () => {
    const res = await GET(req('role=video'));
    const json = await res.json();
    expect(json.suggested.id).toBe('mock-video-1.0');
    expect(json.suggested.provider).toBe('mock');
  });

  it('returns 400 when role is missing', async () => {
    const res = await GET(req(''));
    expect(res.status).toBe(400);
  });

  it('returns 400 when role is invalid', async () => {
    const res = await GET(req('role=unknown'));
    expect(res.status).toBe(400);
  });

  it('providers list includes mock with status=mock', async () => {
    const res = await GET(req('role=video'));
    const json = await res.json();
    const mock = json.providers.find((p: { id: string }) => p.id === 'mock');
    expect(mock?.status).toBe('mock');
  });
});
