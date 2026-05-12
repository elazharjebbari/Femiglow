/**
 * Tests d'intégration de POST /api/admin/delivery-cities/seed.
 *
 * On mock le runner (`runDeliveryCitiesSeed`) pour ne pas dépendre du fichier
 * fixture réel — l'objectif ici est de valider :
 *  - Auth requise.
 *  - Body optionnel (vide = force:false).
 *  - Validation Zod (422 si payload invalide).
 *  - Réponse échoue → 500.
 *  - Réponse OK → 200 + report.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

const runSeedMock = vi.fn();
vi.mock('../../../../../../scripts/seed-delivery-cities', () => ({
  runDeliveryCitiesSeed: (...args: unknown[]) => runSeedMock(...args),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { POST } from './route';

function adminSession() {
  return { adminId: 'adm_1', email: 'a@b.c', issuedAt: 0, expiresAt: 0 } as never;
}

function jsonReq(body?: unknown): Request {
  return new Request('http://x/api/admin/delivery-cities/seed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? '' : JSON.stringify(body),
  });
}

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
  runSeedMock.mockReset();
});

describe('POST /api/admin/delivery-cities/seed', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(401);
    expect(runSeedMock).not.toHaveBeenCalled();
  });

  it('200 sans body (force=false par défaut)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    runSeedMock.mockResolvedValue({
      fixturePath: '/fake/path.json',
      importer: { parsed: 500, unique: 430, dropped: 70, droppedReasons: {} },
      database: { inserted: 430, updated: 0, skipped: 0, preservedSlugs: [] },
    });
    const res = await POST(jsonReq());
    expect(res.status).toBe(200);
    expect(runSeedMock).toHaveBeenCalledWith(
      expect.objectContaining({ force: false, actorId: 'adm_1' }),
    );
  });

  it('200 avec body { force: true }', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    runSeedMock.mockResolvedValue({
      fixturePath: '/fake/path.json',
      importer: { parsed: 1, unique: 1, dropped: 0, droppedReasons: {} },
      database: { inserted: 0, updated: 1, skipped: 0, preservedSlugs: [] },
    });
    const res = await POST(jsonReq({ force: true }));
    expect(res.status).toBe(200);
    expect(runSeedMock).toHaveBeenCalledWith(
      expect.objectContaining({ force: true }),
    );
  });

  it('422 si payload Zod invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(jsonReq({ force: 'oui-svp' }));
    expect(res.status).toBe(422);
    expect(runSeedMock).not.toHaveBeenCalled();
  });

  it('400 si JSON invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(
      new Request('http://x/api/admin/delivery-cities/seed', {
        method: 'POST',
        body: '{ pas du json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('500 si le runner échoue', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    runSeedMock.mockRejectedValue(new Error('fixture absent'));
    const res = await POST(jsonReq({}));
    expect(res.status).toBe(500);
  });

  it('renvoie le report + elapsedMs', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    runSeedMock.mockResolvedValue({
      fixturePath: '/fake/path.json',
      importer: { parsed: 5, unique: 5, dropped: 0, droppedReasons: {} },
      database: {
        inserted: 5,
        updated: 0,
        skipped: 0,
        preservedSlugs: [],
      },
    });
    const res = await POST(jsonReq({}));
    const body = (await res.json()) as {
      database: { inserted: number };
      importer: { unique: number };
      elapsedMs: number;
    };
    expect(body.database.inserted).toBe(5);
    expect(body.importer.unique).toBe(5);
    expect(typeof body.elapsedMs).toBe('number');
  });
});
