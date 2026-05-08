import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { GET, POST } from './route';

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
});

function bearer(secret = process.env.CRON_SECRET): Headers {
  const h = new Headers();
  h.set('authorization', `Bearer ${secret}`);
  return h;
}

function adminSession() {
  return { adminId: 'adm_1', email: 'a@b.c', issuedAt: 0, expiresAt: 0 } as never;
}

describe('GET /api/admin/analytics/insights/refresh', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('200 avec session, lastRun null si jamais exécuté', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lastRun: unknown; enabled: boolean };
    expect(body.lastRun).toBeNull();
    expect(body.enabled).toBe(true);
  });
});

describe('POST /api/admin/analytics/insights/refresh', () => {
  it('200 cron Bearer valide', async () => {
    const res = await POST(
      new Request('http://x/api/admin/analytics/insights/refresh', {
        method: 'POST',
        headers: bearer(),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('401 cron Bearer absent + pas de session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await POST(
      new Request('http://x/api/admin/analytics/insights/refresh', {
        method: 'POST',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('200 admin session manuel', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(
      new Request('http://x/api/admin/analytics/insights/refresh', {
        method: 'POST',
      }),
    );
    expect(res.status).toBe(200);
  });

  it('429 si refresh déjà en cours', async () => {
    memoryStore().insightsRefreshRun.set('irf_active', {
      id: 'irf_active',
      trigger: 'cron',
      status: 'running',
      startedAt: new Date(Date.now() - 60_000),
      finishedAt: null,
      durationsMs: {},
      counts: {},
      errorCode: null,
      errorMessage: null,
      triggeredBy: null,
    });
    const res = await POST(
      new Request('http://x/api/admin/analytics/insights/refresh', {
        method: 'POST',
        headers: bearer(),
      }),
    );
    expect(res.status).toBe(429);
  });

  it('réponse contient runId + durationsMs + counts', async () => {
    const res = await POST(
      new Request('http://x/api/admin/analytics/insights/refresh', {
        method: 'POST',
        headers: bearer(),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      runId: string;
      durationsMs: Record<string, number>;
      counts: Record<string, number>;
    };
    expect(body.ok).toBe(true);
    expect(body.runId).toMatch(/^irf_/);
    expect(body.durationsMs).toBeDefined();
    expect(body.counts).toBeDefined();
  });

  it('refresh entre dans l\'historique insights_refresh_run', async () => {
    await POST(
      new Request('http://x/api/admin/analytics/insights/refresh', {
        method: 'POST',
        headers: bearer(),
      }),
    );
    expect(memoryStore().insightsRefreshRun.size).toBe(1);
    const run = Array.from(memoryStore().insightsRefreshRun.values())[0]!;
    expect(run.status).toBe('success');
    expect(run.trigger).toBe('cron');
  });

  it('Bearer mais wrong → 401 (cohérent avec route)', async () => {
    const h = new Headers();
    h.set('authorization', 'Bearer wrong-secret');
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await POST(
      new Request('http://x/api/admin/analytics/insights/refresh', {
        method: 'POST',
        headers: h,
      }),
    );
    // Pas le bon Bearer + pas de session admin → 401
    expect(res.status).toBe(401);
  });
});
