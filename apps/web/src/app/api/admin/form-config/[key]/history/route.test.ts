/**
 * Tests de GET /api/admin/form-config/[key]/history.
 *
 *  - 401 sans session.
 *  - 404 clé inconnue.
 *  - 200 retourne items triés DESC par version.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

vi.mock('@/lib/checkout/repos/form-config-repo', () => ({
  formConfigRepo: {
    listHistory: vi.fn(),
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

function plainReq(key: string): Request {
  return new Request(`http://x/api/admin/form-config/${key}/history`);
}

function fakeHistoryRow(version: number) {
  return {
    id: `fch_${version}`,
    formConfigId: 'fc_wizard_kit',
    key: 'wizard_kit',
    version,
    action: 'update' as const,
    description: `version ${version}`,
    actorId: 'adm_1',
    config: {},
    createdAt: new Date(`2026-05-${String(version).padStart(2, '0')}`),
  };
}

beforeEach(() => {
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(formConfigRepo.listHistory).mockReset();
});

describe('GET /api/admin/form-config/[key]/history', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET(plainReq('wizard_kit'), { params: { key: 'wizard_kit' } });
    expect(res.status).toBe(401);
  });

  it('404 clé inconnue', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(plainReq('inconnu'), { params: { key: 'inconnu' } });
    expect(res.status).toBe(404);
  });

  it('200 trie DESC par version', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    // Repo retourne dans n'importe quel ordre (DB unspecified)
    vi.mocked(formConfigRepo.listHistory).mockResolvedValue([
      fakeHistoryRow(1),
      fakeHistoryRow(3),
      fakeHistoryRow(2),
    ]);

    const res = await GET(plainReq('wizard_kit'), { params: { key: 'wizard_kit' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ version: number }> };
    expect(body.items.map((i) => i.version)).toEqual([3, 2, 1]);
  });
});
