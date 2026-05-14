/**
 * Suite intégration — Cron + Health public.
 *
 * Couvre :
 *  - GET /api/cron/legal-link-health : 401 sans Bearer, 200 avec, payload
 *    inclut checked/inserted/broken/duration_ms, purge >30j déclenchée.
 *  - GET /api/health/legal : 200 si globalStatus=ok && pas d'orphelin,
 *    503 sinon. Payload inclut brokenLinks détaillé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cronAuthMock = vi.fn();
vi.mock('@/lib/chat/services/auth-cron', () => ({
  isAuthorizedCron: (req: Request) => cronAuthMock(req),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma', CRON_SECRET: 'secret' },
}));

vi.mock('@/lib/legal/link-verifier', () => ({
  gatherPlacementsToCheck: vi.fn(),
  classifyLink: vi.fn(),
  checkLinkOverHttp: vi.fn(),
  recordSnapshots: vi.fn(),
  purgeOldSnapshots: vi.fn(),
  summarizeLinkHealth: vi.fn(),
}));

vi.mock('@/lib/legal/repository', () => ({
  pagesWithMissingPlacements: vi.fn(),
}));

import * as linkVerifier from '@/lib/legal/link-verifier';
import * as repo from '@/lib/legal/repository';

import { GET as cronGet } from '@/app/api/cron/legal-link-health/route';
import { GET as healthGet } from '@/app/api/health/legal/route';

import type { NextRequest } from 'next/server';

beforeEach(() => {
  cronAuthMock.mockReset();
  for (const fn of Object.values(linkVerifier)) {
    if (typeof fn === 'function') (vi.mocked(fn) as ReturnType<typeof vi.fn>).mockReset();
  }
  vi.mocked(repo.pagesWithMissingPlacements).mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('GET /api/cron/legal-link-health', () => {
  it('401 si pas autorisé', async () => {
    cronAuthMock.mockReturnValue(false);
    const res = await cronGet(new Request('http://x') as unknown as NextRequest);
    expect(res.status).toBe(401);
  });

  it('200 avec checked=0 si aucune cible', async () => {
    cronAuthMock.mockReturnValue(true);
    vi.mocked(linkVerifier.gatherPlacementsToCheck).mockResolvedValue([]);
    const res = await cronGet(new Request('http://x') as unknown as NextRequest);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checked: number };
    expect(body.checked).toBe(0);
  });

  it('exécute HTTP check + insère snapshots + purge', async () => {
    cronAuthMock.mockReturnValue(true);
    vi.mocked(linkVerifier.gatherPlacementsToCheck).mockResolvedValue([
      { zoneKey: 'footer-main', pageSlug: 'cgv' },
      { zoneKey: 'footer-main', pageSlug: 'cookies' },
    ]);
    vi.mocked(linkVerifier.checkLinkOverHttp).mockImplementation(
      async (_baseUrl, t) => ({
        zoneKey: t.zoneKey,
        pageSlug: t.pageSlug,
        status: t.pageSlug === 'cookies' ? 'http_4xx' : 'ok',
        httpCode: t.pageSlug === 'cookies' ? 404 : 200,
        latencyMs: 12,
        notes: null,
      }),
    );
    vi.mocked(linkVerifier.recordSnapshots).mockResolvedValue(2);
    vi.mocked(linkVerifier.purgeOldSnapshots).mockResolvedValue(5);

    const res = await cronGet(new Request('http://x') as unknown as NextRequest);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      checked: number;
      inserted: number;
      broken: number;
      purged: number;
      duration_ms: number;
    };
    expect(body.checked).toBe(2);
    expect(body.inserted).toBe(2);
    expect(body.broken).toBe(1); // cookies = http_4xx
    expect(body.purged).toBe(5);
    expect(body.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /api/health/legal', () => {
  it('200 si globalStatus=ok et pas d\'orphelin', async () => {
    vi.mocked(linkVerifier.summarizeLinkHealth).mockResolvedValue({
      globalStatus: 'ok',
      lastCheckedAt: new Date(),
      byZone: [],
    });
    vi.mocked(repo.pagesWithMissingPlacements).mockResolvedValue([]);

    const res = await healthGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; brokenLinks: unknown[] };
    expect(body.status).toBe('ok');
    expect(body.brokenLinks).toEqual([]);
  });

  it('503 si pages orphelines existent', async () => {
    vi.mocked(linkVerifier.summarizeLinkHealth).mockResolvedValue({
      globalStatus: 'ok',
      lastCheckedAt: new Date(),
      byZone: [],
    });
    vi.mocked(repo.pagesWithMissingPlacements).mockResolvedValue(['orpheline']);

    const res = await healthGet();
    expect(res.status).toBe(503);
    const body = (await res.json()) as { orphanPages: string[] };
    expect(body.orphanPages).toEqual(['orpheline']);
  });

  it('503 si broken links + payload contient les détails', async () => {
    vi.mocked(linkVerifier.summarizeLinkHealth).mockResolvedValue({
      globalStatus: 'error',
      lastCheckedAt: new Date(),
      byZone: [
        {
          zoneKey: 'footer-main',
          ok: 0,
          broken: 1,
          links: [
            { pageSlug: 'cgv', status: 'http_4xx', httpCode: 404, checkedAt: new Date() },
          ],
        },
      ],
    });
    vi.mocked(repo.pagesWithMissingPlacements).mockResolvedValue([]);

    const res = await healthGet();
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      brokenLinks: Array<{ zone: string; slug: string; status: string }>;
    };
    expect(body.brokenLinks).toEqual([
      { zone: 'footer-main', slug: 'cgv', status: 'http_4xx' },
    ]);
  });

  it('500 si erreur interne (DB down par ex.)', async () => {
    vi.mocked(linkVerifier.summarizeLinkHealth).mockRejectedValue(new Error('db'));
    vi.mocked(repo.pagesWithMissingPlacements).mockResolvedValue([]);

    const res = await healthGet();
    expect(res.status).toBe(500);
  });
});
