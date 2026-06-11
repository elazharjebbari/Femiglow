/**
 * F07 — Contract GET /api/admin/coupons/grants : FILTRES + masquage (extension).
 *
 * Complète grants/route.test.ts (masquage + filtre phone + 403) : filtre statut,
 * combinaison phone+status, résultat vide, total cohérent, session manquante.
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/07-api-grants.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { issueGrant, redeemGrant } from '@/lib/db/queries/coupon-grant-repo';

const session = { adminId: 'adm_1', email: 'op@femiglow.local' };
let role = 'admin';
let hasSession = true;

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(async () => (hasSession ? session : null)),
}));
vi.mock('@/lib/legal/permissions', async (orig) => {
  const actual = await orig<typeof import('@/lib/legal/permissions')>();
  return { ...actual, getAdminRole: vi.fn(async () => role) };
});

import { GET } from './route';

const DAY = 24 * 3600 * 1000;

beforeEach(() => {
  resetMemoryStore();
  role = 'admin';
  hasSession = true;
});

function req(qs = ''): Request {
  return new Request(`http://localhost/api/admin/coupons/grants${qs}`);
}

/** Sème : 2 issued (phones distincts) + 1 redeemed. */
async function seed() {
  await issueGrant({ templateCouponId: 't', leadId: null, sourceOrderId: 'o_a', valueCents: 2000, phoneE164: '+212600000001', activatesAt: new Date(Date.now() - DAY) });
  await issueGrant({ templateCouponId: 't', leadId: null, sourceOrderId: 'o_b', valueCents: 2000, phoneE164: '+212600000002', activatesAt: new Date(Date.now() - DAY) });
  const g = await issueGrant({ templateCouponId: 't', leadId: null, sourceOrderId: 'o_c', valueCents: 2000, phoneE164: '+212600000003', activatesAt: new Date(Date.now() - DAY) });
  await redeemGrant(g!.code, 'o_redeemed');
}

describe('F07 grants filters', () => {
  it('F07-I001 filtre status=issued → uniquement les actifs', async () => {
    await seed();
    const json = await (await GET(req('?status=issued'))).json();
    expect(json.items.length).toBe(2);
    expect(json.items.every((g: { status: string }) => g.status === 'issued')).toBe(true);
  });

  it('F07-I002 filtre status=redeemed → uniquement les consommés', async () => {
    await seed();
    const json = await (await GET(req('?status=redeemed'))).json();
    expect(json.items.length).toBe(1);
    expect(json.items[0].status).toBe('redeemed');
  });

  it('F07-I003 combinaison phone + status', async () => {
    await seed();
    const json = await (await GET(req('?phone=%2B212600000001&status=issued'))).json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].phone).toMatch(/…|\*/);
  });

  it('F07-I004 combinaison incohérente (phone redeemed mais filtré issued) → vide', async () => {
    await seed();
    const json = await (await GET(req('?phone=%2B212600000003&status=issued'))).json();
    expect(json.items).toHaveLength(0);
    expect(json.total).toBe(0);
  });

  it('F07-I005 total === items.length', async () => {
    await seed();
    const json = await (await GET(req())).json();
    expect(json.total).toBe(json.items.length);
    expect(json.total).toBe(3);
  });

  it('F07-I006 INV-PII : aucun téléphone en clair dans la réponse', async () => {
    await seed();
    const json = await (await GET(req())).json();
    for (const g of json.items) {
      expect(g.phone).not.toMatch(/\d{6,}/);
    }
  });

  it('F07-I007 sans session → 401', async () => {
    hasSession = false;
    expect((await GET(req())).status).toBe(401);
  });
});
