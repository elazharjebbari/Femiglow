/**
 * Tests POST /api/admin/kit/video/cover/test-url.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { POST } from './route';

function adminSession() {
  return { adminId: 'adm_1', email: 'a@b.c', issuedAt: 0, expiresAt: 0 } as never;
}

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.mocked(getAdminSession).mockReset();
  fetchSpy = vi.fn();
  (globalThis as any).fetch = fetchSpy;
});

afterEach(() => {
  delete (globalThis as any).fetch;
});

function jsonRequest(payload: unknown): Request {
  return new Request('http://test/api/admin/kit/video/cover/test-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('POST /api/admin/kit/video/cover/test-url', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await POST(jsonRequest({ url: 'https://x.com/a.svg' }));
    expect(res.status).toBe(401);
  });

  it('422 si body invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(422);
  });

  it('200 ok=true quand HEAD retourne SVG valide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    fetchSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: { 'content-type': 'image/svg+xml', 'content-length': '1234' },
      }),
    );
    const res = await POST(jsonRequest({ url: 'https://cdn.example.com/cover.svg' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; contentType?: string; size?: number };
    expect(body.ok).toBe(true);
    expect(body.contentType).toBe('image/svg+xml');
    expect(body.size).toBe(1234);
  });

  it('200 ok=false sur URL HTTP non-HTTPS', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(jsonRequest({ url: 'http://cdn.example.com/cover.svg' }));
    const body = (await res.json()) as { ok: boolean; reason?: string };
    expect(body.ok).toBe(false);
    expect(body.reason).toMatch(/HTTPS/i);
  });

  it('200 ok=false sur content-type non SVG', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    fetchSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
    const res = await POST(jsonRequest({ url: 'https://cdn.example.com/cover.png' }));
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });
});
