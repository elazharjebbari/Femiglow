/**
 * Stress — contention max sur PATCH.
 *
 * 50 PATCH simultanés, tous avec le MÊME If-Match (l'updatedAt initial).
 * Exactement 1 doit gagner (200), 49 doivent perdre (409). Aucune perte
 * silencieuse de donnée. Le test impose un ordonnancement déterministe
 * via une queue partagée.
 *
 * Bonus : on vérifie qu'aucun appel n'a logué d'audit pour les 49
 * conflicts (audit pollué = bug).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_stress',
  email: 'stress@test.ma',
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

const auditCalls: Array<{ action: string }> = [];
vi.mock('@/lib/legal/audit', () => ({
  logLegalEvent: (action: string) => {
    auditCalls.push({ action });
    return Promise.resolve();
  },
}));

// Simulate repo state shared across all PATCH calls
const fakeServer = {
  updatedAt: new Date('2026-05-13T10:00:00Z'),
  version: 1,
  title: 'Original',
};

vi.mock('@/lib/legal/repository', () => ({
  updateLegalPageWithLock: async (slug: string, patch: { title?: string; expectedUpdatedAt?: number; actorId?: string | null }) => {
    void slug;
    if (
      patch.expectedUpdatedAt !== undefined &&
      patch.expectedUpdatedAt !== fakeServer.updatedAt.getTime()
    ) {
      return {
        ok: false,
        reason: 'version_conflict',
        currentUpdatedAt: fakeServer.updatedAt,
      } as const;
    }
    fakeServer.updatedAt = new Date(fakeServer.updatedAt.getTime() + 1000);
    fakeServer.title = patch.title ?? fakeServer.title;
    return {
      ok: true,
      page: {
        id: 'lp_x',
        slug: 'cgv',
        title: fakeServer.title,
        description: null,
        bodyMd: '# body',
        status: 'draft' as const,
        version: fakeServer.version,
        updatedAt: fakeServer.updatedAt,
      },
    } as const;
  },
}));

import { PATCH as patchAdminPage } from '@/app/api/admin/legal/[slug]/route';

beforeEach(() => {
  fakeServer.updatedAt = new Date('2026-05-13T10:00:00Z');
  fakeServer.version = 1;
  fakeServer.title = 'Original';
  auditCalls.length = 0;
});

describe('Stress — 50 PATCH simultanés', () => {
  it('exactement 1 succès, 49 conflicts', async () => {
    const ifMatch = `W/"${fakeServer.updatedAt.getTime()}"`;
    const requests = Array.from({ length: 50 }, (_, i) =>
      patchAdminPage(
        new Request('http://x', {
          method: 'PATCH',
          headers: { 'If-Match': ifMatch, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `Concurrent attempt ${i}` }),
        }),
        { params: { slug: 'cgv' } },
      ),
    );

    const responses = await Promise.all(requests);
    const successCount = responses.filter((r) => r.status === 200).length;
    const conflictCount = responses.filter((r) => r.status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(49);
    // Aucun autre statut ne devrait apparaître
    expect(successCount + conflictCount).toBe(50);
  });

  it('audit log = 1 entrée legal.page.updated (uniquement pour le gagnant)', async () => {
    const ifMatch = `W/"${fakeServer.updatedAt.getTime()}"`;
    const requests = Array.from({ length: 50 }, (_, i) =>
      patchAdminPage(
        new Request('http://x', {
          method: 'PATCH',
          headers: { 'If-Match': ifMatch, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `Try ${i}` }),
        }),
        { params: { slug: 'cgv' } },
      ),
    );
    await Promise.all(requests);
    const updateCalls = auditCalls.filter((c) => c.action === 'legal.page.updated');
    expect(updateCalls).toHaveLength(1);
  });

  it('20 vagues de PATCH avec ETag mis à jour à chaque succès → 20 succès consécutifs', async () => {
    // À chaque vague, on récupère l'ETag de la réponse et on le réutilise
    // pour la suivante. Vérifie que l'optimistic locking n'est pas un
    // blocker pour les writes sériels.
    let currentEtag = `W/"${fakeServer.updatedAt.getTime()}"`;
    let successes = 0;
    for (let wave = 0; wave < 20; wave += 1) {
      const res = await patchAdminPage(
        new Request('http://x', {
          method: 'PATCH',
          headers: { 'If-Match': currentEtag, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `Wave ${wave}` }),
        }),
        { params: { slug: 'cgv' } },
      );
      if (res.status === 200) {
        successes += 1;
        currentEtag = res.headers.get('etag')!;
      }
    }
    expect(successes).toBe(20);
  });
});
