/**
 * Règles pures d'un code promo marketing (`checkPromoCoupon`) + résolution
 * unifiée crédit/promo (`resolveRedeemableCode`) sur memoryStore.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { createCoupon } from '@/lib/db/queries/coupon-repo';
import * as grantRepo from '@/lib/db/queries/coupon-grant-repo';
import type { CouponDef } from '@/lib/coupons/types';
import type { CouponInput } from '@/lib/coupons/schemas';
import { checkPromoCoupon, resolveRedeemableCode, validatePromoCode } from './promo-code';

const DAY = 24 * 3600 * 1000;
const NOW = new Date('2026-09-10T12:00:00Z');

function def(over: Partial<CouponDef> = {}): CouponDef {
  return {
    id: 'cpn_test',
    label: 'Promo',
    code: 'GLOW99',
    type: 'manual_code',
    mode: 'code',
    status: 'active',
    valueKind: 'fixed_amount',
    valueAmount: 10000,
    target: 'product_price',
    currency: 'MAD',
    eligibility: {},
    startsAt: null,
    endsAt: null,
    stackable: true,
    usageScope: 'unlimited',
    usageCap: null,
    usageCount: 0,
    holdoutPct: 0,
    priority: 10,
    createdAt: new Date(0),
    ...over,
  };
}

describe('checkPromoCoupon — règles pures', () => {
  it('actif, sans fenêtre → valide avec valueCents = valueAmount', () => {
    const r = checkPromoCoupon(def(), NOW);
    expect(r).toMatchObject({ valid: true, valueCents: 10000 });
  });
  it('mode auto → not_found (pas saisissable)', () => {
    expect(checkPromoCoupon(def({ mode: 'auto', code: null }), NOW)).toEqual({
      valid: false,
      reason: 'not_found',
    });
  });
  it.each(['draft', 'paused', 'archived'] as const)('statut %s → inactive', (status) => {
    expect(checkPromoCoupon(def({ status }), NOW)).toEqual({ valid: false, reason: 'inactive' });
  });
  it('startsAt futur → not_yet_active ; endsAt passé → expired', () => {
    expect(checkPromoCoupon(def({ startsAt: new Date(NOW.getTime() + DAY) }), NOW)).toEqual({
      valid: false,
      reason: 'not_yet_active',
    });
    expect(checkPromoCoupon(def({ endsAt: new Date(NOW.getTime() - DAY) }), NOW)).toEqual({
      valid: false,
      reason: 'expired',
    });
  });
  it('bornes inclusives : valide pile dans la fenêtre', () => {
    const r = checkPromoCoupon(
      def({ startsAt: new Date(NOW.getTime() - DAY), endsAt: new Date(NOW.getTime() + DAY) }),
      NOW,
    );
    expect(r.valid).toBe(true);
  });
  it('percent ou cible ≠ product_price → unsupported', () => {
    expect(checkPromoCoupon(def({ valueKind: 'percent', valueAmount: 50 }), NOW)).toEqual({
      valid: false,
      reason: 'unsupported',
    });
    expect(checkPromoCoupon(def({ target: 'shipping' }), NOW)).toEqual({
      valid: false,
      reason: 'unsupported',
    });
  });
  it('plafond global : cap_reached quand usageCount ≥ usageCap, sinon valide', () => {
    expect(
      checkPromoCoupon(def({ usageScope: 'global_cap', usageCap: 5, usageCount: 5 }), NOW),
    ).toEqual({ valid: false, reason: 'cap_reached' });
    expect(
      checkPromoCoupon(def({ usageScope: 'global_cap', usageCap: 5, usageCount: 4 }), NOW).valid,
    ).toBe(true);
    // Scope unlimited ignore le cap même s'il est renseigné.
    expect(checkPromoCoupon(def({ usageCap: 1, usageCount: 99 }), NOW).valid).toBe(true);
  });
});

describe('validatePromoCode / resolveRedeemableCode — memoryStore', () => {
  beforeEach(() => resetMemoryStore());

  const INPUT: CouponInput = {
    label: 'Promo Meta 99',
    code: 'GLOW99',
    type: 'manual_code',
    mode: 'code',
    status: 'active',
    valueKind: 'fixed_amount',
    valueAmount: 10000,
    target: 'product_price',
    currency: 'MAD',
    eligibility: {},
    stackable: true,
    usageScope: 'unlimited',
    usageCap: null,
    holdoutPct: 0,
    priority: 10,
  };

  it('lookup insensible à la casse et aux espaces', async () => {
    await createCoupon(INPUT, null);
    expect((await validatePromoCode('  glow99 ')).valid).toBe(true);
    expect((await validatePromoCode('GLOW98')).valid).toBe(false);
  });

  it('resolveRedeemableCode → promo quand aucun grant ne porte le code', async () => {
    await createCoupon(INPUT, null);
    const r = await resolveRedeemableCode('glow99');
    expect(r).toMatchObject({ valid: true, kind: 'promo', code: 'GLOW99', valueCents: 10000 });
  });

  it('resolveRedeemableCode → credit prioritaire, avec grantCode normalisé', async () => {
    const g = await grantRepo.issueGrant({
      templateCouponId: 'cpn_tpl',
      leadId: null,
      sourceOrderId: 'o_src',
      valueCents: 2000,
      activatesAt: new Date(Date.now() - DAY),
    });
    const r = await resolveRedeemableCode(g!.code.toLowerCase());
    expect(r).toMatchObject({ valid: true, kind: 'credit', valueCents: 2000, grantCode: g!.code });
  });

  it('grant connu mais expiré → son motif, pas not_found', async () => {
    const g = await grantRepo.issueGrant({
      templateCouponId: 'cpn_tpl',
      leadId: null,
      sourceOrderId: 'o_old',
      valueCents: 2000,
      activatesAt: new Date(Date.now() - 70 * DAY),
    });
    expect(await resolveRedeemableCode(g!.code)).toEqual({ valid: false, reason: 'expired' });
  });

  it('code inconnu partout → not_found', async () => {
    expect(await resolveRedeemableCode('NOPE123')).toEqual({ valid: false, reason: 'not_found' });
  });
});
