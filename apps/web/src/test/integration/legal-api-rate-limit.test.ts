/**
 * Suite intégration — rate limiting sur routes legal.
 *
 * Couvre :
 *  - public GET /api/legal/[slug] : 60/min/IP → 61e renvoie 429 + Retry-After
 *  - public GET /api/legal/placements/[zone] : 60/min/IP
 *  - admin POST /api/admin/legal/[slug]/publish : 5/min/admin
 *  - admin POST /api/admin/legal/health/recheck : 1/min/admin
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSession } from '@/lib/auth/session';

let sessionMock: AdminSession | null = {
  adminId: 'adm_burst',
  email: 'burst@test.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

vi.mock('@/lib/legal/csrf', () => ({
  requireSameOrigin: vi.fn(),
  checkSameOrigin: vi.fn(() => ({ ok: true })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/legal/audit', () => ({
  logLegalEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/legal/repository', () => ({
  getPublishedLegalPage: vi.fn(),
  listAllTemplateVars: vi.fn().mockResolvedValue([]),
  listPlacementsForZone: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/legal/publish', () => ({
  publishLegalPage: vi.fn().mockResolvedValue({
    ok: true,
    version: 2,
    publishedAt: new Date(),
  }),
}));

vi.mock('@/lib/legal/link-verifier', () => ({
  gatherPlacementsToCheck: vi.fn().mockResolvedValue([]),
  classifyLink: vi.fn(),
  checkLinkOverHttp: vi.fn(),
  recordSnapshots: vi.fn(),
}));

import { GET as getLegalPage } from '@/app/api/legal/[slug]/route';
import { GET as getZonePlacements } from '@/app/api/legal/placements/[zone]/route';
import { POST as publishRoute } from '@/app/api/admin/legal/[slug]/publish/route';
import { POST as recheckRoute } from '@/app/api/admin/legal/health/recheck/route';

import { resetMemoryStore } from '@/lib/db/client';
import { getPublishedLegalPage } from '@/lib/legal/repository';

beforeEach(() => {
  resetMemoryStore();
  sessionMock = {
    adminId: 'adm_burst',
    email: 'burst@test.ma',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600_000,
  };
  vi.mocked(getPublishedLegalPage).mockResolvedValue({
    slug: 'cgv',
    title: 'CGV',
    bodyMd: '# CGV',
    description: 'd',
    status: 'published',
    version: 1,
    publishedAt: new Date(),
    updatedAt: new Date(),
    includeInSearch: false,
    canonicalUrl: null,
  } as never);
});

function mkPublicRequest(ip = '203.0.113.42'): Request {
  return new Request('http://x', { headers: { 'x-forwarded-for': ip } });
}

describe('rate-limit public — /api/legal/[slug]', () => {
  it('renvoie X-RateLimit-* sur la 1ère requête', async () => {
    const res = await getLegalPage(mkPublicRequest('203.0.113.1'), { params: { slug: 'cgv' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(Number(res.headers.get('X-RateLimit-Remaining'))).toBeLessThan(60);
  });

  it('429 après 60 requêtes dans la fenêtre', async () => {
    const ip = '203.0.113.2';
    for (let i = 0; i < 60; i += 1) {
      await getLegalPage(mkPublicRequest(ip), { params: { slug: 'cgv' } });
    }
    const res = await getLegalPage(mkPublicRequest(ip), { params: { slug: 'cgv' } });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toMatch(/^\d+$/);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('rate_limited');
  });

  it('isole par IP (IP différentes ne se partagent pas le quota)', async () => {
    const ipA = '203.0.113.10';
    const ipB = '203.0.113.20';
    for (let i = 0; i < 60; i += 1) {
      await getLegalPage(mkPublicRequest(ipA), { params: { slug: 'cgv' } });
    }
    // ipA est saturée mais ipB doit pouvoir passer
    const blocked = await getLegalPage(mkPublicRequest(ipA), { params: { slug: 'cgv' } });
    expect(blocked.status).toBe(429);
    const ok = await getLegalPage(mkPublicRequest(ipB), { params: { slug: 'cgv' } });
    expect(ok.status).toBe(200);
  });
});

describe('rate-limit public — /api/legal/placements/[zone]', () => {
  it('429 après 60 requêtes', async () => {
    const ip = '203.0.113.30';
    for (let i = 0; i < 60; i += 1) {
      await getZonePlacements(mkPublicRequest(ip), { params: { zone: 'footer-main' } });
    }
    const res = await getZonePlacements(mkPublicRequest(ip), {
      params: { zone: 'footer-main' },
    });
    expect(res.status).toBe(429);
  });
});

describe('rate-limit admin — POST /publish', () => {
  it('5 publish/min/admin, 6e renvoie 429', async () => {
    const mkReq = () =>
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      });

    for (let i = 0; i < 5; i += 1) {
      const r = await publishRoute(mkReq(), { params: { slug: 'cgv' } });
      expect([200, 422]).toContain(r.status);
    }
    const r6 = await publishRoute(mkReq(), { params: { slug: 'cgv' } });
    expect(r6.status).toBe(429);
  });

  it('admins différents ne partagent pas le quota', async () => {
    const mkReq = () =>
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      });
    // adm_A saturé
    sessionMock = { ...sessionMock!, adminId: 'adm_A' };
    for (let i = 0; i < 5; i += 1) {
      await publishRoute(mkReq(), { params: { slug: 'cgv' } });
    }
    const blocked = await publishRoute(mkReq(), { params: { slug: 'cgv' } });
    expect(blocked.status).toBe(429);
    // adm_B doit pouvoir passer
    sessionMock = { ...sessionMock!, adminId: 'adm_B' };
    const ok = await publishRoute(mkReq(), { params: { slug: 'cgv' } });
    expect(ok.status).toBe(200);
  });
});

describe('rate-limit admin — POST /health/recheck', () => {
  it('1 recheck/min/admin, 2e renvoie 429', async () => {
    const first = await recheckRoute();
    expect(first.status).toBe(200);
    const second = await recheckRoute();
    expect(second.status).toBe(429);
    expect(second.headers.get('Retry-After')).toBeDefined();
  });
});
