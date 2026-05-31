/**
 * Tests de POST /api/admin/form-config/[key]/rollback.
 *
 *  - 401, 404 (clé inconnue), 400 (If-Match), 422 (Zod), 409 (version stale),
 *    404 (targetVersion inexistante), 200 (OK + audit + revalidate).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

vi.mock('@/lib/checkout/repos/form-config-repo', () => ({
  formConfigRepo: {
    getByKey: vi.fn(),
    rollback: vi.fn(),
  },
}));

vi.mock('@/lib/audit/log-event', () => ({
  logAuditEvent: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';
import { logAuditEvent } from '@/lib/audit/log-event';
import { POST } from './route';

function adminSession() {
  return {
    adminId: 'adm_1',
    email: 'a@b.c',
    issuedAt: 0,
    expiresAt: 0,
  } as never;
}

function rollbackReq(key: string, body: unknown, ifMatch?: string | null): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (ifMatch !== null && ifMatch !== undefined) headers['If-Match'] = ifMatch;
  return new Request(`http://x/api/admin/form-config/${key}/rollback`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fc_wizard_kit',
    key: 'wizard_kit',
    version: 5,
    active: true,
    config: {},
    description: 'desc',
    createdAt: new Date('2026-05-01'),
    updatedAt: new Date('2026-05-12'),
    createdBy: null,
    updatedBy: 'adm_1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(formConfigRepo.getByKey).mockReset();
  vi.mocked(formConfigRepo.rollback).mockReset();
  vi.mocked(logAuditEvent).mockReset();
  vi.mocked(revalidatePath).mockReset();
});

describe('POST /api/admin/form-config/[key]/rollback', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await POST(
      rollbackReq('wizard_kit', { targetVersion: 1 }, '5'),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(401);
  });

  it('404 clé inconnue', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(
      rollbackReq('inconnu', { targetVersion: 1 }, '5'),
      { params: { key: 'inconnu' } },
    );
    expect(res.status).toBe(404);
  });

  it('400 If-Match manquant', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(
      rollbackReq('wizard_kit', { targetVersion: 1 }, null),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(400);
  });

  it('422 Zod payload invalide (targetVersion négatif)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(
      rollbackReq('wizard_kit', { targetVersion: -1 }, '5'),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(422);
  });

  it('409 version stale', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    vi.mocked(formConfigRepo.getByKey).mockResolvedValue(fakeRow({ version: 5 }));
    const res = await POST(
      rollbackReq('wizard_kit', { targetVersion: 1 }, '3'),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(409);
  });

  it('404 si targetVersion inexistante (rollback retourne null)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    vi.mocked(formConfigRepo.getByKey).mockResolvedValue(fakeRow({ version: 5 }));
    vi.mocked(formConfigRepo.rollback).mockResolvedValue(null);
    const res = await POST(
      rollbackReq('wizard_kit', { targetVersion: 999 }, '5'),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(404);
  });

  it('200 rollback réussi + audit + revalidate', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    vi.mocked(formConfigRepo.getByKey).mockResolvedValue(fakeRow({ version: 5 }));
    vi.mocked(formConfigRepo.rollback).mockResolvedValue(
      fakeRow({ version: 6 }),
    );

    const res = await POST(
      rollbackReq('wizard_kit', { targetVersion: 1 }, '5'),
      { params: { key: 'wizard_kit' } },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(6);

    expect(vi.mocked(logAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'form-config.rollback',
        resourceType: 'form_config',
        resourceId: 'wizard_kit',
        meta: expect.objectContaining({
          toVersion: 6,
          fromVersion: 5,
          rolledBackTo: 1,
        }),
      }),
    );
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(
      '/api/checkout/form-config/wizard_kit',
    );
  });
});
