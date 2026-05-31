import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { getCachedAnalytics, setCachedAnalytics } from '@/lib/analytics/cache';
import { POST } from './route';

function bearer(secret = process.env.CRON_SECRET): Headers {
  const h = new Headers();
  h.set('authorization', `Bearer ${secret}`);
  return h;
}

function adminSession() {
  return { adminId: 'adm_1', email: 'a@b.c', issuedAt: 0, expiresAt: 0 } as never;
}

function req(headers?: Headers): Request {
  return new Request('http://x/api/admin/analytics/refresh', { method: 'POST', headers });
}

beforeEach(() => {
  vi.mocked(getAdminSession).mockReset();
});

describe('POST /api/admin/analytics/refresh', () => {
  it('401 sans session ni cron', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it('200 avec session admin → vide le cache snapshot + renvoie le statut matviews', async () => {
    setCachedAnalytics('cta:x', { v: 1 }, 30_000, 1000);
    expect(getCachedAnalytics('cta:x', 30_000, 1000)).toEqual({ v: 1 });

    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      cacheCleared: boolean;
      matviews: Array<{ view: string; ok: boolean }>;
    };
    expect(body.ok).toBe(true);
    expect(body.cacheCleared).toBe(true);
    expect(Array.isArray(body.matviews)).toBe(true);
    // le snapshot a bien été vidé
    expect(getCachedAnalytics('cta:x', 30_000, 1000)).toBeNull();
  });

  it('200 avec cron Bearer valide (sans session)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await POST(req(bearer()));
    expect(res.status).toBe(200);
  });
});
