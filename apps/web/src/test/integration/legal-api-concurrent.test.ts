/**
 * Race conditions sur les routes legal :
 *  - 2 PATCH simultanés avec le même If-Match → 1 succès, 1 conflict
 *  - PATCH pendant que publish tourne → conflict après publish (version bumpée)
 *  - Burst de POST publish (rate-limit + 4-eyes interaction)
 *
 * Le repo est simulé via mocks pour reproduire de la concurrence
 * déterministe (sans DB réelle).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_a',
  email: 'a@b.c',
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/legal/csrf', () => ({
  requireSameOrigin: vi.fn(),
  checkSameOrigin: vi.fn(() => ({ ok: true })),
}));

vi.mock('@/lib/legal/audit', () => ({
  logLegalEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/legal/repository', () => ({
  getLegalPageBySlug: vi.fn(),
  updateLegalPageWithLock: vi.fn(),
  listAllPlacements: vi.fn().mockResolvedValue([]),
  listAllTemplateVars: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/legal/publish', () => ({
  publishLegalPage: vi.fn(),
}));

import { PATCH as patchAdminPage } from '@/app/api/admin/legal/[slug]/route';
import { POST as publishRoute } from '@/app/api/admin/legal/[slug]/publish/route';
import { resetMemoryStore } from '@/lib/db/client';
import * as publishMod from '@/lib/legal/publish';
import * as repo from '@/lib/legal/repository';

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(repo.updateLegalPageWithLock).mockReset();
  vi.mocked(publishMod.publishLegalPage).mockReset();
});

describe('PATCH concurrent — 2 admins same If-Match', () => {
  it('1er gagne, 2nd reçoit 409 version_conflict', async () => {
    const initial = new Date('2026-05-13T10:00:00Z');
    let serverUpdatedAt = initial;

    // Premier PATCH : succès, met à jour serverUpdatedAt
    // Deuxième PATCH : reçoit l'If-Match du 1er (initial) mais le serveur est déjà à serverUpdatedAt+1
    vi.mocked(repo.updateLegalPageWithLock).mockImplementation(
      async (_slug, patch) => {
        const expected = patch.expectedUpdatedAt;
        if (expected !== serverUpdatedAt.getTime()) {
          return {
            ok: false,
            reason: 'version_conflict',
            currentUpdatedAt: serverUpdatedAt,
          };
        }
        serverUpdatedAt = new Date(serverUpdatedAt.getTime() + 1000);
        return {
          ok: true,
          page: {
            id: 'lp_x',
            slug: 'cgv',
            title: patch.title ?? 'X',
            description: null,
            bodyMd: '# X',
            status: 'draft',
            version: 1,
            updatedAt: serverUpdatedAt,
          } as never,
        };
      },
    );

    const ifMatchHeader = `W/"${initial.getTime()}"`;
    const mkRequest = (title: string) =>
      new Request('http://x', {
        method: 'PATCH',
        headers: { 'If-Match': ifMatchHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

    // Lance 2 PATCH en // — JavaScript étant single-threaded, ils s'ordonnent
    // mais le 2nd a déjà été préparé avec le même If-Match.
    const [res1, res2] = await Promise.all([
      patchAdminPage(mkRequest('First'), { params: { slug: 'cgv' } }),
      patchAdminPage(mkRequest('Second'), { params: { slug: 'cgv' } }),
    ]);

    // Un succès, un conflit
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });
});

describe('PATCH pendant publish concurrent', () => {
  it('Si publish bumpe version, PATCH suivant avec If-Match obsolète → 409', async () => {
    const t0 = new Date('2026-05-13T10:00:00Z');
    let serverUpdatedAt = t0;

    vi.mocked(publishMod.publishLegalPage).mockImplementation(async () => {
      // Le publish met à jour le timestamp serveur
      serverUpdatedAt = new Date(serverUpdatedAt.getTime() + 5000);
      return { ok: true, version: 2, publishedAt: serverUpdatedAt };
    });

    vi.mocked(repo.updateLegalPageWithLock).mockImplementation(
      async (_slug, patch) => {
        if (patch.expectedUpdatedAt !== serverUpdatedAt.getTime()) {
          return {
            ok: false,
            reason: 'version_conflict',
            currentUpdatedAt: serverUpdatedAt,
          };
        }
        serverUpdatedAt = new Date(serverUpdatedAt.getTime() + 1000);
        return {
          ok: true,
          page: { slug: 'cgv', updatedAt: serverUpdatedAt } as never,
        };
      },
    );

    // 1. publish part → bump timestamp serveur
    await publishRoute(
      new Request('http://x', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'PUBLIER' }),
      }),
      { params: { slug: 'cgv' } },
    );

    // 2. PATCH avec ancien If-Match (avant le publish)
    const patchRes = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        headers: { 'If-Match': `W/"${t0.getTime()}"`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated after publish' }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(patchRes.status).toBe(409);
  });
});

describe('PATCH idempotent avec ETag à jour', () => {
  it('PATCH même payload 2 fois → 2 succès si If-Match suit le rythme', async () => {
    let serverUpdatedAt = new Date('2026-05-13T10:00:00Z');

    vi.mocked(repo.updateLegalPageWithLock).mockImplementation(
      async (_slug, patch) => {
        if (patch.expectedUpdatedAt !== serverUpdatedAt.getTime()) {
          return {
            ok: false,
            reason: 'version_conflict',
            currentUpdatedAt: serverUpdatedAt,
          };
        }
        serverUpdatedAt = new Date(serverUpdatedAt.getTime() + 1000);
        return {
          ok: true,
          page: { slug: 'cgv', updatedAt: serverUpdatedAt } as never,
        };
      },
    );

    let ifMatch = `W/"${serverUpdatedAt.getTime()}"`;
    const res1 = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        headers: { 'If-Match': ifMatch, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Title One' }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res1.status).toBe(200);

    // Récupère le nouveau ETag depuis la réponse
    const etag1 = res1.headers.get('etag');
    expect(etag1).toBeTruthy();
    ifMatch = etag1!;

    const res2 = await patchAdminPage(
      new Request('http://x', {
        method: 'PATCH',
        headers: { 'If-Match': ifMatch, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Title Two' }),
      }),
      { params: { slug: 'cgv' } },
    );
    expect(res2.status).toBe(200);
  });
});
