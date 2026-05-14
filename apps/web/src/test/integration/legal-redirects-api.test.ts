/**
 * Tests intégration — API /api/admin/legal/redirects.
 * GET liste, POST create (201, 400 identical, 409 duplicate, 422 invalid),
 * DELETE remove (200, 404 not found).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_r',
  email: 'r@x',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
}));

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

vi.mock('@/lib/legal/csrf', () => ({
  requireSameOrigin: vi.fn(),
}));

const auditMock = vi.fn();
vi.mock('@/lib/legal/audit', () => ({
  logLegalEvent: (...args: unknown[]) => {
    auditMock(...args);
    return Promise.resolve();
  },
}));

vi.mock('@/lib/legal/redirects', () => ({
  listSlugRedirects: vi.fn(),
  createSlugRedirect: vi.fn(),
  deleteSlugRedirect: vi.fn(),
}));

import * as redirectsLib from '@/lib/legal/redirects';
import {
  GET as redirectsGet,
  POST as redirectsPost,
  DELETE as redirectsDelete,
} from '@/app/api/admin/legal/redirects/route';

beforeEach(() => {
  auditMock.mockClear();
  vi.mocked(redirectsLib.listSlugRedirects).mockReset();
  vi.mocked(redirectsLib.createSlugRedirect).mockReset();
  vi.mocked(redirectsLib.deleteSlugRedirect).mockReset();
});

afterEach(() => vi.clearAllMocks());

describe('GET /api/admin/legal/redirects', () => {
  it('200 + liste sérialisée', async () => {
    vi.mocked(redirectsLib.listSlugRedirects).mockResolvedValue([
      {
        oldSlug: 'cgv-old',
        newSlug: 'cgv',
        createdAt: new Date('2026-05-01T00:00:00Z'),
        createdBy: 'adm_X',
      } as never,
    ]);
    const res = await redirectsGet();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ old_slug: string; new_slug: string }>;
    expect(body).toEqual([
      expect.objectContaining({
        old_slug: 'cgv-old',
        new_slug: 'cgv',
        created_by: 'adm_X',
      }),
    ]);
  });
});

describe('POST /api/admin/legal/redirects', () => {
  it('201 + audit sur création réussie', async () => {
    vi.mocked(redirectsLib.createSlugRedirect).mockResolvedValue({
      ok: true,
      row: {
        oldSlug: 'old-slug',
        newSlug: 'new-slug',
        createdAt: new Date(),
        createdBy: 'adm_r',
      } as never,
    });
    const res = await redirectsPost(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ oldSlug: 'old-slug', newSlug: 'new-slug' }),
      }),
    );
    expect(res.status).toBe(201);
    expect(auditMock).toHaveBeenCalledWith(
      'legal.page.created',
      'adm_r',
      'old-slug',
      expect.objectContaining({
        action: 'slug_redirect_created',
        old_slug: 'old-slug',
        new_slug: 'new-slug',
      }),
    );
  });

  it('400 si oldSlug === newSlug', async () => {
    vi.mocked(redirectsLib.createSlugRedirect).mockResolvedValue({
      ok: false,
      reason: 'identical',
    });
    const res = await redirectsPost(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ oldSlug: 'same', newSlug: 'same' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('409 si duplicate', async () => {
    vi.mocked(redirectsLib.createSlugRedirect).mockResolvedValue({
      ok: false,
      reason: 'duplicate',
    });
    const res = await redirectsPost(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ oldSlug: 'old-slug', newSlug: 'new-slug' }),
      }),
    );
    expect(res.status).toBe(409);
  });

  it('422 si payload invalide (slug avec UPPER)', async () => {
    const res = await redirectsPost(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ oldSlug: 'BAD', newSlug: 'b' }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('400 si JSON invalide', async () => {
    const res = await redirectsPost(
      new Request('http://x', { method: 'POST', body: 'not-json' }),
    );
    expect(res.status).toBe(400);
  });

  it('500 si db_error', async () => {
    vi.mocked(redirectsLib.createSlugRedirect).mockResolvedValue({
      ok: false,
      reason: 'db_error',
    });
    const res = await redirectsPost(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ oldSlug: 'old-slug', newSlug: 'new-slug' }),
      }),
    );
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/admin/legal/redirects', () => {
  it('200 + audit sur succès', async () => {
    vi.mocked(redirectsLib.deleteSlugRedirect).mockResolvedValue(true);
    const res = await redirectsDelete(
      new Request('http://x', {
        method: 'DELETE',
        body: JSON.stringify({ oldSlug: 'old-slug' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(auditMock).toHaveBeenCalledWith(
      'legal.page.archived',
      'adm_r',
      'old-slug',
      expect.objectContaining({
        action: 'slug_redirect_deleted',
        old_slug: 'old-slug',
      }),
    );
  });

  it('404 si rowCount === 0', async () => {
    vi.mocked(redirectsLib.deleteSlugRedirect).mockResolvedValue(false);
    const res = await redirectsDelete(
      new Request('http://x', {
        method: 'DELETE',
        body: JSON.stringify({ oldSlug: 'unknown' }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it('400 si oldSlug invalide', async () => {
    const res = await redirectsDelete(
      new Request('http://x', {
        method: 'DELETE',
        body: JSON.stringify({ oldSlug: 'BAD' }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('Auth — 401 sans session', () => {
  it('GET sans session', async () => {
    const realSession = { ...sessionMock };
    Object.assign(sessionMock, { adminId: '' });
    (sessionMock as unknown as { adminId: null }).adminId = null as never;
    // Approche plus simple : vider la session via mock
    const mod = await import('@/lib/auth/require-admin');
    vi.spyOn(mod, 'getAdminSession').mockResolvedValueOnce(null);
    const res = await redirectsGet();
    expect(res.status).toBe(401);
    // Restore
    Object.assign(sessionMock, realSession);
  });
});
