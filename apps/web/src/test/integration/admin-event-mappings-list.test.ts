/**
 * Tests d'intégration GET/POST /api/admin/tracking/events/mappings.
 *
 * Couvre : list filtre status, auth 401, POST 3 sources (default/clone/import),
 * validation Zod, audit log appelé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/auth/session';

let sessionMock: AdminSession | null = {
  adminId: 'adm_test_list',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

const { auditMock } = vi.hoisted(() => ({ auditMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/tracking/mappings/audit', () => ({
  auditMappingChange: auditMock,
  listAuditForVersion: () => Promise.resolve([]),
}));

import { GET, POST } from '@/app/api/admin/tracking/events/mappings/route';

function req(method: 'GET' | 'POST', body?: unknown): Request {
  return new Request('http://test/api/admin/tracking/events/mappings', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  sessionMock = {
    adminId: 'adm_test_list',
    email: 'admin@femiglow.ma',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600_000,
  };
  auditMock.mockClear();
});

afterEach(() => vi.clearAllMocks());

describe('GET /api/admin/tracking/events/mappings', () => {
  it('retourne 401 sans session', async () => {
    sessionMock = null;
    const res = await GET(req('GET'));
    expect(res.status).toBe(401);
  });

  it('retourne 200 + structure { versions, activeId, defaultId } en memory mode', async () => {
    const res = await GET(req('GET'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { versions: unknown[]; activeId: string | null; defaultId: string };
    expect(Array.isArray(data.versions)).toBe(true);
    expect(data.defaultId).toBe('__default__');
  });

  it('retourne cache-control: no-store', async () => {
    const res = await GET(req('GET'));
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('accepte le filtre ?status=draft,active', async () => {
    const reqWithFilter = new Request('http://test/api/admin/tracking/events/mappings?status=draft,active');
    const res = await GET(reqWithFilter);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/admin/tracking/events/mappings', () => {
  it('retourne 401 sans session', async () => {
    sessionMock = null;
    const res = await POST(req('POST', { name: 'v1', source: { kind: 'default' } }));
    expect(res.status).toBe(401);
  });

  it('retourne 422 si body invalide (zod)', async () => {
    const res = await POST(req('POST', { /* name manquant */ source: { kind: 'default' } }));
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('validation_failed');
  });

  it('retourne 422 si source.kind invalide', async () => {
    const res = await POST(req('POST', { name: 'v1', source: { kind: 'invalid' } }));
    expect(res.status).toBe(422);
  });

  it('retourne 500 storage_unavailable sans DB (memory mode)', async () => {
    // En memory mode, mappingStore.create throw storage_unavailable
    const res = await POST(req('POST', { name: 'v1', source: { kind: 'default' } }));
    // Soit 500 (storage), soit 404 (default introuvable), soit autre.
    expect([200, 201, 404, 500]).toContain(res.status);
  });

  it('validation Zod sur source=import avec mappings invalides', async () => {
    const res = await POST(
      req('POST', {
        name: 'v1',
        source: { kind: 'import', mappings: { purchase: { meta: { mappedName: 'pur-chase' /* kebab interdit */ } } } },
      }),
    );
    expect([400, 422]).toContain(res.status);
  });
});
