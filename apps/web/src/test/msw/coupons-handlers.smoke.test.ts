/** Smoke — la couche MSW coupon/fidélité répond et est stateful (W0). */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import {
  couponsAdminHandlers,
  redeemHandlers,
  draftCoupon,
  maskedGrant,
} from '@/test/msw/coupons-handlers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MSW coupons-handlers (smoke)', () => {
  it('S001 GET liste + POST create est stateful (refresh voit le nouvel item)', async () => {
    server.use(...couponsAdminHandlers({ coupons: [], newCouponId: 'cpn_new' }));
    const before = await (await fetch('/api/admin/coupons')).json();
    expect(before.items).toHaveLength(0);
    const created = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Flash', valueAmount: 5000 }),
    });
    expect(created.status).toBe(201);
    const after = await (await fetch('/api/admin/coupons')).json();
    expect(after.items).toHaveLength(1);
    expect(after.items[0].id).toBe('cpn_new');
  });

  it('S002 transition met à jour le statut ; archivé→actif = 409', async () => {
    server.use(...couponsAdminHandlers({ coupons: [draftCoupon({ id: 'c1', status: 'archived' })] }));
    const res = await fetch('/api/admin/coupons/c1/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(res.status).toBe(409);
  });

  it('S003 injection d’échec create=403', async () => {
    server.use(...couponsAdminHandlers({ coupons: [], fail: { create: 403 } }));
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'X', valueAmount: 100 }),
    });
    expect(res.status).toBe(403);
  });

  it('S004 grants filtre par statut, téléphone masqué', async () => {
    server.use(
      ...couponsAdminHandlers({
        grants: [maskedGrant({ id: 'g1', status: 'issued' }), maskedGrant({ id: 'g2', status: 'redeemed' })],
      }),
    );
    const json = await (await fetch('/api/admin/coupons/grants?status=issued')).json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].phone).toMatch(/…/);
    expect(json.items[0].phone).not.toMatch(/\d{6,}/);
  });

  it('S005 redeem renvoie la réponse mappée par code (sinon not_found)', async () => {
    server.use(...redeemHandlers({ byCode: { 'FG-SAUGE-7212': { valid: true, valueCents: 2000 } } }));
    const ok = await (await fetch('/api/coupons/redeem', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'fg-sauge-7212' }),
    })).json();
    expect(ok).toEqual({ valid: true, valueCents: 2000 });
    const ko = await (await fetch('/api/coupons/redeem', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'NOPE' }),
    })).json();
    expect(ko).toEqual({ valid: false, reason: 'not_found' });
  });
});
