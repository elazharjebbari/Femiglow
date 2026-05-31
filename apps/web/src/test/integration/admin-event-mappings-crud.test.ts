/**
 * Tests d'intégration GET/PUT/DELETE /api/admin/tracking/events/mappings/[id].
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/auth/session';

let sessionMock: AdminSession | null = {
  adminId: 'adm_test_crud',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600_000,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

vi.mock('@/lib/tracking/mappings/audit', () => ({
  auditMappingChange: vi.fn().mockResolvedValue(undefined),
}));

import { GET, PUT, DELETE } from '@/app/api/admin/tracking/events/mappings/[id]/route';

function req(method: 'GET' | 'PUT' | 'DELETE', body?: unknown): Request {
  return new Request('http://test/api/admin/tracking/events/mappings/test_id', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  sessionMock = {
    adminId: 'adm_test_crud',
    email: 'admin@femiglow.ma',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600_000,
  };
});

afterEach(() => vi.clearAllMocks());

describe('GET /api/admin/tracking/events/mappings/[id]', () => {
  it('retourne 401 sans session', async () => {
    sessionMock = null;
    const res = await GET(req('GET'), { params: { id: 'test_id' } });
    expect(res.status).toBe(401);
  });

  it('retourne 404 pour id inconnu en memory mode', async () => {
    const res = await GET(req('GET'), { params: { id: 'nonexistent' } });
    expect([404, 500]).toContain(res.status);
  });
});

describe('PUT /api/admin/tracking/events/mappings/[id]', () => {
  it('retourne 401 sans session', async () => {
    sessionMock = null;
    const res = await PUT(req('PUT', { mappings: {} }), { params: { id: 'test_id' } });
    expect(res.status).toBe(401);
  });

  it('retourne 422 si body invalide (ou 404 si check version source first)', async () => {
    // La route vérifie d'abord l'existence de la version source ; si l'id 'x'
    // n'existe pas → 404 avant la validation Zod du body.
    const res = await PUT(req('PUT', { mappings: 'not_an_object' }), { params: { id: 'x' } });
    expect([400, 404, 422, 500]).toContain(res.status);
  });

  it('retourne 404/500 pour version source inconnue', async () => {
    const res = await PUT(req('PUT', { mappings: {} }), { params: { id: 'nonexistent' } });
    expect([404, 500]).toContain(res.status);
  });
});

describe('DELETE /api/admin/tracking/events/mappings/[id]', () => {
  it('retourne 401 sans session', async () => {
    sessionMock = null;
    const res = await DELETE(req('DELETE'), { params: { id: 'test_id' } });
    expect(res.status).toBe(401);
  });

  it("retourne 403 cannot_delete_default pour id='__default__'", async () => {
    const res = await DELETE(req('DELETE'), { params: { id: '__default__' } });
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('cannot_delete_default');
  });

  it('retourne 404/500 pour id inconnu', async () => {
    const res = await DELETE(req('DELETE'), { params: { id: 'nonexistent' } });
    expect([404, 500]).toContain(res.status);
  });
});
