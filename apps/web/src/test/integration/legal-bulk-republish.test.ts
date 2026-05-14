/**
 * Tests intégration — POST /api/admin/legal/bulk-republish
 * + GET /api/admin/legal/template-vars/[key]/usage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_b',
  email: 'b@x',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/legal/csrf', () => ({
  requireSameOrigin: vi.fn(),
}));

vi.mock('@/lib/legal/repository', () => ({
  listPagesUsingVar: vi.fn(),
}));

vi.mock('@/lib/legal/publish', () => ({
  publishLegalPage: vi.fn(),
}));

import * as repo from '@/lib/legal/repository';
import * as publishMod from '@/lib/legal/publish';
import { POST as bulkRepublishRoute } from '@/app/api/admin/legal/bulk-republish/route';
import { GET as usageRoute } from '@/app/api/admin/legal/template-vars/[key]/usage/route';

beforeEach(() => {
  vi.mocked(repo.listPagesUsingVar).mockReset();
  vi.mocked(publishMod.publishLegalPage).mockReset();
});

describe('GET /template-vars/[key]/usage', () => {
  it('200 + count + slugs', async () => {
    vi.mocked(repo.listPagesUsingVar).mockResolvedValue(['cgv', 'cookies']);
    const res = await usageRoute(new Request('http://x'), { params: { key: 'COMPANY_RC' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { key: string; count: number; slugs: string[] };
    expect(body).toEqual({ key: 'COMPANY_RC', count: 2, slugs: ['cgv', 'cookies'] });
  });

  it('400 si key invalide', async () => {
    const res = await usageRoute(new Request('http://x'), { params: { key: 'bad key' } });
    expect(res.status).toBe(400);
  });

  it('401 sans session', async () => {
    const mod = await import('@/lib/auth/require-admin');
    vi.spyOn(mod, 'getAdminSession').mockResolvedValueOnce(null);
    const res = await usageRoute(new Request('http://x'), { params: { key: 'X' } });
    expect(res.status).toBe(401);
  });
});

describe('POST /bulk-republish', () => {
  it('200 + republie chaque page séquentiellement', async () => {
    vi.mocked(repo.listPagesUsingVar).mockResolvedValue(['cgv', 'cookies']);
    vi.mocked(publishMod.publishLegalPage).mockResolvedValue({
      ok: true,
      version: 2,
      publishedAt: new Date(),
    });

    const res = await bulkRepublishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ varKey: 'COMPANY_RC' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      varKey: string;
      total: number;
      succeeded: number;
      failed: number;
      results: Array<{ slug: string; ok: boolean; version?: number }>;
    };
    expect(body.total).toBe(2);
    expect(body.succeeded).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.results).toHaveLength(2);
    expect(body.results.every((r) => r.ok)).toBe(true);
    // publishLegalPage appelé 2 fois avec confirm='PUBLIER'
    expect(vi.mocked(publishMod.publishLegalPage)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(publishMod.publishLegalPage)).toHaveBeenCalledWith(
      'cgv',
      'PUBLIER',
      'adm_b',
    );
  });

  it('compte les failures', async () => {
    vi.mocked(repo.listPagesUsingVar).mockResolvedValue(['cgv', 'cookies', 'cgu']);
    vi.mocked(publishMod.publishLegalPage)
      .mockResolvedValueOnce({ ok: true, version: 2, publishedAt: new Date() })
      .mockResolvedValueOnce({ ok: false, code: 'missing_required_vars', missing: ['X'] })
      .mockResolvedValueOnce({ ok: true, version: 3, publishedAt: new Date() });

    const res = await bulkRepublishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ varKey: 'COMPANY_RC' }),
      }),
    );
    const body = (await res.json()) as { succeeded: number; failed: number };
    expect(body.succeeded).toBe(2);
    expect(body.failed).toBe(1);
  });

  it('total=0 si aucune page n\'utilise la var', async () => {
    vi.mocked(repo.listPagesUsingVar).mockResolvedValue([]);
    const res = await bulkRepublishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ varKey: 'NEVER_USED' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; succeeded: number };
    expect(body.total).toBe(0);
    expect(body.succeeded).toBe(0);
    expect(vi.mocked(publishMod.publishLegalPage)).not.toHaveBeenCalled();
  });

  it('422 si varKey invalide', async () => {
    const res = await bulkRepublishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ varKey: 'bad key' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('400 si JSON invalide', async () => {
    const res = await bulkRepublishRoute(
      new Request('http://x', { method: 'POST', body: 'not-json' }),
    );
    expect(res.status).toBe(400);
  });

  it('401 sans session', async () => {
    const mod = await import('@/lib/auth/require-admin');
    vi.spyOn(mod, 'getAdminSession').mockResolvedValueOnce(null);
    const res = await bulkRepublishRoute(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ varKey: 'X' }) }),
    );
    expect(res.status).toBe(401);
  });
});
