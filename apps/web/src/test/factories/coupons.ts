/**
 * Factories de test pour le domaine coupons — fixtures minimales et lisibles.
 * cf. docs/coupons-qa-2026-06-02/00-overview/tooling.md.
 */
import type { CouponContext, CouponDef } from '@/lib/coupons/types';

let seq = 0;

/** Coupon d'accueil canonique Phase 1 (-90 MAD), surchargeable. */
export function makeCoupon(overrides: Partial<CouponDef> = {}): CouponDef {
  seq += 1;
  return {
    id: overrides.id ?? `cpn_test_${seq}`,
    label: 'Geste d’accueil',
    code: null,
    type: 'welcome_auto',
    mode: 'auto',
    status: 'active',
    valueKind: 'fixed_amount',
    valueAmount: 9000,
    target: 'product_price',
    currency: 'MAD',
    eligibility: {},
    startsAt: null,
    endsAt: null,
    stackable: false,
    usageScope: 'unlimited',
    usageCap: null,
    usageCount: 0,
    holdoutPct: 0,
    priority: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function makeContext(overrides: Partial<CouponContext> = {}): CouponContext {
  return {
    visitorType: 'first',
    trafficSource: null,
    device: 'mobile',
    visitorKey: 'vk_test',
    now: new Date('2026-06-02T10:00:00Z'),
    ...overrides,
  };
}
