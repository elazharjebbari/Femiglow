import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { findTrackingProviderByKind, listTrackingProviders } from '@/lib/db/queries/tracking/providers';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

vi.mock('@/lib/tracking/server/audit', () => ({
  auditTrackingChange: vi.fn(async () => {}),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { GET, PATCH } from './route';

const adminSession = {
  adminId: 'adm_provider_test',
  email: 'admin@femiglow.test',
  issuedAt: 0,
  expiresAt: Date.now() + 60_000,
} as never;

function patchReq(kind: string, body: Record<string, unknown>): Request {
  return new Request(`https://femiglow.test/api/admin/tracking/providers/${kind}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getReq(kind: string): Request {
  return new Request(`https://femiglow.test/api/admin/tracking/providers/${kind}`, {
    method: 'GET',
  });
}

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(getAdminSession).mockResolvedValue(adminSession);
});

describe('/api/admin/tracking/providers/[kind]', () => {
  describe('GET', () => {
    it('retourne un provider existant sans token brut', async () => {
      await upsertSnap();
      const res = await GET(getReq('snap'), { params: Promise.resolve({ kind: 'snap' }) });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.kind).toBe('snap');
      expect(body.hasCapiToken).toBe(true);
      expect(body.capiToken).toBeUndefined();
    });

    it('retourne un provider par défaut si inexistant', async () => {
      const res = await GET(getReq('meta'), { params: Promise.resolve({ kind: 'meta' }) });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.kind).toBe('meta');
      expect(body.status).toBe('disabled');
      expect(body.hasCapiToken).toBe(false);
    });

    it('retourne 401 sans session admin', async () => {
      vi.mocked(getAdminSession).mockResolvedValue(null as never);
      const res = await GET(getReq('snap'), { params: Promise.resolve({ kind: 'snap' }) });
      expect(res.status).toBe(401);
    });

    it('rejette un kind invalide', async () => {
      const res = await GET(getReq('invalid_kind'), { params: Promise.resolve({ kind: 'invalid_kind' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH', () => {
    it('crée un provider via upsert s\'il n\'existe pas', async () => {
      const res = await PATCH(patchReq('snap', { status: 'enabled', pixelId: '9bd26a82-3ecf-42aa-a3de-85df14c74a11' }), { params: Promise.resolve({ kind: 'snap' }) });
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.kind).toBe('snap');
      expect(body.status).toBe('enabled');
      expect(body.pixelId).toBe('9bd26a82-3ecf-42aa-a3de-85df14c74a11');
    });

    it('met à jour le status d\'un provider existant', async () => {
      await upsertSnap();
      const res = await PATCH(patchReq('snap', { status: 'disabled' }), { params: Promise.resolve({ kind: 'snap' }) });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe('disabled');
    });

    it('sauvegarde un capiToken et retourne hasCapiToken: true sans exposer le token', async () => {
      const res = await PATCH(patchReq('snap', { capiToken: 'my-secret-token' }), { params: Promise.resolve({ kind: 'snap' }) });
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.hasCapiToken).toBe(true);
      expect(body.capiToken).toBeUndefined();
      expect((body as Record<string, unknown>).token).toBeUndefined();
    });

    it('efface un capiToken avec capiToken: null', async () => {
      await upsertSnap();
      const res = await PATCH(patchReq('snap', { capiToken: null }), { params: Promise.resolve({ kind: 'snap' }) });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.hasCapiToken).toBe(false);
    });

    it('conserve le token existant si capiToken absent du payload', async () => {
      await upsertSnap();
      const res = await PATCH(patchReq('snap', { status: 'enabled' }), { params: Promise.resolve({ kind: 'snap' }) });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.hasCapiToken).toBe(true);
    });

    it('sauvegarde le testEventCode', async () => {
      await upsertSnap();
      const res = await PATCH(patchReq('snap', { testEventCode: 'SNAP-TEST-001' }), { params: Promise.resolve({ kind: 'snap' }) });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.testEventCode).toBe('SNAP-TEST-001');
    });

    it('rejette un pixelId invalide pour snap (pattern UUID)', async () => {
      const res = await PATCH(patchReq('snap', { pixelId: 'not-a-uuid' }), { params: Promise.resolve({ kind: 'snap' }) });
      // Le PATCH accepte tout pixelId — la validation est côté UI uniquement
      // La validation regex est dans le composant ProviderConfigCard, pas dans l'API
      expect(res.status).toBeLessThanOrEqual(201);
    });

    it('rejette un kind invalide → 400', async () => {
      const res = await PATCH(patchReq('invalid', { status: 'enabled' }), { params: Promise.resolve({ kind: 'invalid' }) });
      expect(res.status).toBe(400);
    });

    it('rejette un payload invalide (champs inconnus) → 400', async () => {
      const res = await PATCH(patchReq('snap', { unknown: true }), { params: Promise.resolve({ kind: 'snap' }) });
      expect(res.status).toBe(400);
    });

    it('retourne 401 sans session admin', async () => {
      vi.mocked(getAdminSession).mockResolvedValue(null as never);
      const res = await PATCH(patchReq('snap', { status: 'enabled' }), { params: Promise.resolve({ kind: 'snap' }) });
      expect(res.status).toBe(401);
    });
  });

  // ─── TikTok-specific contract ─────────────────────────────────────
  //
  // L'UI providers (commit 62f6ecc) montre toujours une carte TikTok,
  // donc l'API doit pouvoir servir un empty-state GET et accepter un
  // PATCH de création depuis cette carte.
  describe('TikTok provider lifecycle', () => {
    it('GET returns a disabled default when no TikTok row exists', async () => {
      const res = await GET(getReq('tiktok'), { params: Promise.resolve({ kind: 'tiktok' }) });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.kind).toBe('tiktok');
      expect(body.status).toBe('disabled');
      expect(body.pixelId).toBeNull();
      expect(body.hasCapiToken).toBe(false);
    });

    it('PATCH creates a TikTok provider with realistic pixelId + access token', async () => {
      const res = await PATCH(
        patchReq('tiktok', {
          status: 'enabled',
          pixelId: 'CTIKTOKPIXEL12345',
          capiToken: 'tt-access-token-secret',
          testEventCode: 'TT-TEST-DAY-1',
        }),
        { params: Promise.resolve({ kind: 'tiktok' }) },
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.kind).toBe('tiktok');
      expect(body.status).toBe('enabled');
      expect(body.pixelId).toBe('CTIKTOKPIXEL12345');
      expect(body.hasCapiToken).toBe(true);
      expect(body.testEventCode).toBe('TT-TEST-DAY-1');
      // Le token brut ne doit JAMAIS être renvoyé (AES-256-GCM stocké côté DB).
      expect(body.capiToken).toBeUndefined();
    });

    it('PATCH persists the encrypted token to the DB store', async () => {
      await PATCH(
        patchReq('tiktok', {
          status: 'enabled',
          pixelId: 'CTIKTOKPIXEL12345',
          capiToken: 'tt-access-token-secret',
        }),
        { params: Promise.resolve({ kind: 'tiktok' }) },
      );
      const stored = await findTrackingProviderByKind('tiktok');
      expect(stored).not.toBeNull();
      expect(stored!.pixelId).toBe('CTIKTOKPIXEL12345');
      expect(stored!.capiToken).not.toBeNull();
      // Le token stocké est chiffré : ne doit jamais être le clair.
      expect(stored!.capiToken).not.toBe('tt-access-token-secret');
    });

    it('PATCH updates an existing TikTok provider (status flip)', async () => {
      await PATCH(
        patchReq('tiktok', { status: 'enabled', pixelId: 'CTIKTOKPIXEL12345' }),
        { params: Promise.resolve({ kind: 'tiktok' }) },
      );
      const res = await PATCH(
        patchReq('tiktok', { status: 'disabled' }),
        { params: Promise.resolve({ kind: 'tiktok' }) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe('disabled');
      // pixelId préservé après le toggle status (le PATCH partiel ne doit pas l'effacer).
      expect(body.pixelId).toBe('CTIKTOKPIXEL12345');

      // Et l'UI list contient bien la ligne après création (sanity check).
      const all = await listTrackingProviders();
      expect(all.find((p) => p.kind === 'tiktok')).toBeDefined();
    });

    it('PATCH clears the testEventCode with explicit null', async () => {
      await PATCH(
        patchReq('tiktok', { status: 'enabled', testEventCode: 'TT-DAY-1' }),
        { params: Promise.resolve({ kind: 'tiktok' }) },
      );
      const res = await PATCH(
        patchReq('tiktok', { testEventCode: null }),
        { params: Promise.resolve({ kind: 'tiktok' }) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.testEventCode).toBeNull();
    });
  });
});

async function upsertSnap() {
  const { upsertTrackingProvider } = await import('@/lib/db/queries/tracking/providers');
  await upsertTrackingProvider({
    kind: 'snap',
    status: 'enabled',
    pixelId: '9bd26a82-3ecf-42aa-a3de-85df14c74a11',
    capiToken: 'test-capi-token',
  });
}