/**
 * Tests des endpoints admin GET/PATCH /api/admin/form-config/[key].
 *
 *  - GET 401/404/200.
 *  - PATCH 401, 400 (If-Match manquant), 400 (JSON invalide), 422 (Zod KO),
 *    404 (clé inconnue), 404 (row absente), 409 (version stale), 200 (OK + audit + revalidate).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FormConfigJson } from '@/lib/checkout/form-config/schema';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

vi.mock('@/lib/checkout/repos/form-config-repo', () => ({
  formConfigRepo: {
    getByKey: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/audit/log-event', () => ({
  logAuditEvent: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formConfigRepo } from '@/lib/checkout/repos/form-config-repo';
import { logAuditEvent } from '@/lib/audit/log-event';
import { GET, PATCH } from './route';

const VALID_CONFIG: FormConfigJson = {
  steps: ['lead', 'address', 'payment', 'thank_you'],
  modes: ['wizard_embed'],
  defaults: {
    formMode: 'wizard_embed',
    currency: 'MAD',
    country: 'MA',
    paymentMethods: ['cod'],
    defaultShippingMode: 'standard',
  },
  copy: {
    title: 'Commander',
    cta_lead: 'Continuer',
    cta_address: 'Suivant',
    cta_payment: 'Confirmer',
    thank_you_title: 'Merci',
  },
  validation: {
    phone_min_length: 9,
    phone_max_length: 13,
    require_email_on_thank_you: false,
    require_postal_code: false,
  },
};

function adminSession() {
  return {
    adminId: 'adm_1',
    email: 'a@b.c',
    issuedAt: 0,
    expiresAt: 0,
  } as never;
}

function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fc_wizard_kit',
    key: 'wizard_kit',
    version: 3,
    active: true,
    config: VALID_CONFIG,
    description: 'desc',
    createdAt: new Date('2026-05-01'),
    updatedAt: new Date('2026-05-12'),
    createdBy: null,
    updatedBy: 'adm_1',
    ...overrides,
  };
}

function plainReq(key: string): Request {
  return new Request(`http://x/api/admin/form-config/${key}`);
}

function patchReq(key: string, body: unknown, ifMatch?: string | null): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (ifMatch !== null && ifMatch !== undefined) headers['If-Match'] = ifMatch;
  return new Request(`http://x/api/admin/form-config/${key}`, {
    method: 'PATCH',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(getAdminSession).mockReset();
  vi.mocked(formConfigRepo.getByKey).mockReset();
  vi.mocked(formConfigRepo.update).mockReset();
  vi.mocked(logAuditEvent).mockReset();
  vi.mocked(revalidatePath).mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/form-config/[key]', () => {
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

  it('404 row absente', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    vi.mocked(formConfigRepo.getByKey).mockResolvedValue(null);
    const res = await GET(plainReq('wizard_kit'), { params: { key: 'wizard_kit' } });
    expect(res.status).toBe(404);
  });

  it('200 retourne la row courante', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    vi.mocked(formConfigRepo.getByKey).mockResolvedValue(fakeRow());
    const res = await GET(plainReq('wizard_kit'), { params: { key: 'wizard_kit' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { key: string; version: number };
    expect(body.key).toBe('wizard_kit');
    expect(body.version).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/admin/form-config/[key]', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await PATCH(
      patchReq('wizard_kit', { config: VALID_CONFIG }, '3'),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(401);
  });

  it('404 clé inconnue', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(
      patchReq('inconnu', { config: VALID_CONFIG }, '1'),
      { params: { key: 'inconnu' } },
    );
    expect(res.status).toBe(404);
  });

  it('400 If-Match manquant', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(
      patchReq('wizard_kit', { config: VALID_CONFIG }, null),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(400);
  });

  it('400 If-Match non numérique', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(
      patchReq('wizard_kit', { config: VALID_CONFIG }, 'abc'),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(400);
  });

  it('400 JSON invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(
      patchReq('wizard_kit', 'pas du json', '3'),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(400);
  });

  it('422 Zod payload invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(
      patchReq('wizard_kit', { config: { steps: [] } }, '3'),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(422);
  });

  it('404 row absente', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    vi.mocked(formConfigRepo.getByKey).mockResolvedValue(null);
    const res = await PATCH(
      patchReq('wizard_kit', { config: VALID_CONFIG }, '3'),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(404);
  });

  it('409 version stale', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    vi.mocked(formConfigRepo.getByKey).mockResolvedValue(fakeRow({ version: 5 }));
    const res = await PATCH(
      patchReq('wizard_kit', { config: VALID_CONFIG }, '3'),
      { params: { key: 'wizard_kit' } },
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; details: { currentVersion: number } } };
    expect(body.error.code).toBe('version_conflict');
    expect(body.error.details.currentVersion).toBe(5);
  });

  it('200 update + audit + revalidate', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    vi.mocked(formConfigRepo.getByKey).mockResolvedValue(fakeRow({ version: 3 }));
    vi.mocked(formConfigRepo.update).mockResolvedValue(
      fakeRow({ version: 4, description: 'changed' }),
    );

    const res = await PATCH(
      patchReq(
        'wizard_kit',
        { config: VALID_CONFIG, description: 'changed' },
        '3',
      ),
      { params: { key: 'wizard_kit' } },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number; description: string };
    expect(body.version).toBe(4);
    expect(body.description).toBe('changed');

    // Audit log + revalidate appelés
    expect(vi.mocked(logAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'form-config.update',
        resourceType: 'form_config',
        resourceId: 'wizard_kit',
        meta: expect.objectContaining({ version: 4, previousVersion: 3 }),
      }),
    );
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(
      '/api/checkout/form-config/wizard_kit',
    );
  });
});
