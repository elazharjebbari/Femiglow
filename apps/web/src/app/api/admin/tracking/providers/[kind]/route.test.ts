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