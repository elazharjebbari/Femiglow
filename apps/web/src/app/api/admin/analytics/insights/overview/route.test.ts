import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { GET } from './route';

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
});

function adminSession() {
  return { adminId: 'adm_1', email: 'a@b.c', issuedAt: 0, expiresAt: 0 } as never;
}

describe('GET /api/admin/analytics/insights/overview', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET(new Request('http://x/api/admin/analytics/insights/overview'));
    expect(res.status).toBe(401);
  });

  it('200 avec session, firstRun=true sur table vide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(new Request('http://x/api/admin/analytics/insights/overview'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { firstRun: boolean; kpis: { totalEvents: number } };
    expect(body.firstRun).toBe(true);
    expect(body.kpis.totalEvents).toBe(0);
  });

  it('400 sur filtre invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(
      new Request('http://x/api/admin/analytics/insights/overview?window=forever'),
    );
    expect(res.status).toBe(400);
  });

  it('400 sur custom range > 365j', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(
      new Request(
        'http://x/api/admin/analytics/insights/overview?window=custom&customFrom=2024-01-01&customTo=2026-12-31',
      ),
    );
    expect(res.status).toBe(400);
  });

  it('Cache-Control + X-Insights-Refreshed-At présent', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(new Request('http://x/api/admin/analytics/insights/overview'));
    expect(res.headers.get('cache-control')).toMatch(/private/);
    expect(res.headers.has('x-insights-refreshed-at')).toBe(true);
  });

  it('Cache-Control inclut max-age et stale-while-revalidate', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(new Request('http://x/api/admin/analytics/insights/overview'));
    const cc = res.headers.get('cache-control') ?? '';
    expect(cc).toMatch(/max-age=60/);
    expect(cc).toMatch(/stale-while-revalidate/);
  });

  it('window=7d + filtre env retournés intacts dans le payload', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(
      new Request(
        'http://x/api/admin/analytics/insights/overview?window=7d&env=production&device=mobile',
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      timeseries: { date: string }[];
      heatmap: unknown[];
    };
    expect(Array.isArray(body.timeseries)).toBe(true);
    expect(body.timeseries.length).toBe(7);
    expect(Array.isArray(body.heatmap)).toBe(true);
  });

  it('window=custom valide retourne 200', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(
      new Request(
        'http://x/api/admin/analytics/insights/overview?window=custom&customFrom=2026-01-01&customTo=2026-01-15',
      ),
    );
    expect(res.status).toBe(200);
  });

  it('payload inclut firstRun=true sur table vide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(new Request('http://x/api/admin/analytics/insights/overview'));
    const body = (await res.json()) as { firstRun: boolean; topEvents: unknown[] };
    expect(body.firstRun).toBe(true);
    expect(body.topEvents).toEqual([]);
  });
});
