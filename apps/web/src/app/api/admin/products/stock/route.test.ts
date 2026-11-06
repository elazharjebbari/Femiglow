// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const applyChange = vi.fn();
const logAuditEvent = vi.fn();
let session: { adminId: string; email: string } | null = { adminId: 'adm_1', email: 'a@b.test' };

vi.mock('@/lib/auth/require-admin', () => ({ getAdminSession: async () => session }));
vi.mock('@/lib/checkout/repos/stock-repo', () => ({
  stockRepo: { applyChange: (...a: unknown[]) => applyChange(...a) },
}));
vi.mock('@/lib/audit/log-event', () => ({ logAuditEvent: (...a: unknown[]) => logAuditEvent(...a) }));

import { PATCH } from './route';

const snapshot = {
  variantId: 'pvar_12345678',
  sku: 'FEMI-KIT-100',
  available: 600,
  reserved: 0,
  thresholdLow: 5,
  sellWhenOut: true,
};

function call(body: unknown) {
  return PATCH(
    new Request('http://local.test/api/admin/products/stock', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  );
}

const restock = { variantId: 'pvar_12345678', action: 'restock', value: 100 };

beforeEach(() => {
  session = { adminId: 'adm_1', email: 'a@b.test' };
  applyChange.mockReset().mockResolvedValue({ outcome: 'applied', snapshot });
  logAuditEvent.mockReset().mockResolvedValue(undefined);
});

describe('PATCH /api/admin/products/stock', () => {
  it('refuse sans session', async () => {
    session = null;
    const res = await call(restock);
    expect(res.status).toBe(404);
    expect(applyChange).not.toHaveBeenCalled();
  });

  it('applique une réception et l’audite', async () => {
    const res = await call(restock);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ available: 600, replayed: false });
    expect(logAuditEvent).toHaveBeenCalledOnce();
  });

  it('un échec d’audit ne fait pas croire à un échec de la saisie', async () => {
    logAuditEvent.mockRejectedValue(new Error('audit down'));
    const res = await call(restock);
    expect(res.status).toBe(200);
  });

  it('double envoi : répond sans auditer une seconde fois', async () => {
    applyChange.mockResolvedValue({ outcome: 'replayed', snapshot });
    const res = await call({ ...restock, idempotencyKey: 'saisie-0001' });
    await expect(res.json()).resolves.toMatchObject({ replayed: true });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it('inventaire en conflit : 409 avec le stock actuel', async () => {
    applyChange.mockResolvedValue({ outcome: 'conflict', snapshot: { ...snapshot, available: 497 } });
    const res = await call({
      variantId: 'pvar_12345678',
      action: 'count',
      value: 480,
      expectedAvailable: 500,
    });
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'stock_changed', details: { available: 497 } },
    });
  });

  it('variante inconnue : 404', async () => {
    applyChange.mockResolvedValue({ outcome: 'not_found' });
    expect((await call(restock)).status).toBe(404);
  });

  it('saisie invalide : aucune écriture', async () => {
    const res = await call({ variantId: 'pvar_12345678', action: 'restock', value: -5 });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(applyChange).not.toHaveBeenCalled();
  });
});
