/**
 * Tests d'intégration activate, test, export-gtm, reset-default, diff.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/auth/session';

let sessionMock: AdminSession | null = {
  adminId: 'adm_test_actions',
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

import { POST as activate } from '@/app/api/admin/tracking/events/mappings/[id]/activate/route';
import { POST as testDispatch } from '@/app/api/admin/tracking/events/mappings/[id]/test/route';
import { POST as exportGtm } from '@/app/api/admin/tracking/events/mappings/[id]/export-gtm/route';
import { POST as resetDefault } from '@/app/api/admin/tracking/events/mappings/reset-default/route';
import { GET as diff } from '@/app/api/admin/tracking/events/mappings/[id]/diff/[otherId]/route';

beforeEach(() => {
  sessionMock = {
    adminId: 'adm_test_actions',
    email: 'admin@femiglow.ma',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600_000,
  };
});

afterEach(() => vi.clearAllMocks());

const jsonReq = (url: string, method: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('POST /api/admin/tracking/events/mappings/[id]/activate', () => {
  it('401 sans session', async () => {
    sessionMock = null;
    const res = await activate(jsonReq('http://t/x', 'POST'), { params: { id: 'x' } });
    expect(res.status).toBe(401);
  });

  it('404/500 pour version inconnue en memory mode', async () => {
    const res = await activate(jsonReq('http://t/x', 'POST'), { params: { id: 'nonexistent' } });
    expect([404, 500]).toContain(res.status);
  });
});

describe('POST /api/admin/tracking/events/mappings/[id]/test', () => {
  it('401 sans session', async () => {
    sessionMock = null;
    const res = await testDispatch(
      jsonReq('http://t/x/test', 'POST', { eventName: 'purchase' }),
      { params: { id: 'x' } },
    );
    expect(res.status).toBe(401);
  });

  it('422 si eventName manquant', async () => {
    const res = await testDispatch(jsonReq('http://t/x/test', 'POST', {}), { params: { id: 'x' } });
    expect([400, 422]).toContain(res.status);
  });

  it('404 si version introuvable', async () => {
    const res = await testDispatch(
      jsonReq('http://t/x/test', 'POST', { eventName: 'purchase' }),
      { params: { id: 'nonexistent' } },
    );
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/tracking/events/mappings/[id]/export-gtm', () => {
  it('401 sans session', async () => {
    sessionMock = null;
    const res = await exportGtm(jsonReq('http://t/x/export', 'POST', { env: 'production' }), { params: { id: 'x' } });
    expect(res.status).toBe(401);
  });

  it('accepte env optionnel (default production)', async () => {
    const res = await exportGtm(jsonReq('http://t/x/export', 'POST'), { params: { id: 'nonexistent' } });
    // Memory mode → 404 attendu (version not found) avant la validation env
    expect([404, 500]).toContain(res.status);
  });

  it('422 si env invalide', async () => {
    const res = await exportGtm(
      jsonReq('http://t/x/export', 'POST', { env: 'invalid_env' }),
      { params: { id: 'x' } },
    );
    expect([400, 422]).toContain(res.status);
  });
});

describe('POST /api/admin/tracking/events/mappings/reset-default', () => {
  it('401 sans session', async () => {
    sessionMock = null;
    const res = await resetDefault();
    expect(res.status).toBe(401);
  });

  it("retourne 500 en memory mode (mappingStore.activate('__default__') throw)", async () => {
    const res = await resetDefault();
    expect([404, 500]).toContain(res.status);
  });
});

describe('GET /api/admin/tracking/events/mappings/[id]/diff/[otherId]', () => {
  it('401 sans session', async () => {
    sessionMock = null;
    const res = await diff(jsonReq('http://t/x/diff/y', 'GET'), { params: { id: 'x', otherId: 'y' } });
    expect(res.status).toBe(401);
  });

  it('404 pour versions inconnues', async () => {
    const res = await diff(jsonReq('http://t/x/diff/y', 'GET'), { params: { id: 'nope1', otherId: 'nope2' } });
    expect(res.status).toBe(404);
  });
});
