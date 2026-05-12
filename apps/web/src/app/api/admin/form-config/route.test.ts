/**
 * Tests de l'endpoint admin GET /api/admin/form-config (liste).
 *
 *  - 401 si pas de session.
 *  - 200 retourne les 2 wizards seedés + ceux non seedés ignorés.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

vi.mock('@/lib/checkout/repos/form-config-repo', () => ({
  formConfigRepo: {
    getByKey: vi.fn(),
  },
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';
import { GET } from './route';

function adminSession() {
  return {
    adminId: 'adm_1',
    email: 'a@b.c',
    issuedAt: 0,
    expiresAt: 0,
  } as never;
}

function fakeRow(key: string, version = 1, active = true) {
  return {
    id: `fc_${key}`,
    key,
    version,
    active,
    config: {},
    description: null,
    createdAt: new Date('2026-05-01'),
    updatedAt: new Date('2026-05-12'),
    createdBy: null,
    updatedBy: 'adm_1',
  };
}

beforeEach(() => {
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(formConfigRepo.getByKey).mockReset();
});

describe('GET /api/admin/form-config', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('200 retourne les 2 wizards seedés', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    vi.mocked(formConfigRepo.getByKey)
      .mockResolvedValueOnce(fakeRow('wizard_kit', 3, true))
      .mockResolvedValueOnce(fakeRow('wizard_commander', 5, false));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ key: string; version: number; active: boolean }> };
    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.key).toBe('wizard_kit');
    expect(body.items[0]?.version).toBe(3);
    expect(body.items[1]?.key).toBe('wizard_commander');
    expect(body.items[1]?.active).toBe(false);
  });

  it('ignore les wizards non seedés (renvoie liste partielle)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    vi.mocked(formConfigRepo.getByKey)
      .mockResolvedValueOnce(fakeRow('wizard_kit'))
      .mockResolvedValueOnce(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ key: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.key).toBe('wizard_kit');
  });
});
