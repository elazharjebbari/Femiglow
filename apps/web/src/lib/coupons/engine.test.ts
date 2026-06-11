/**
 * Tests moteur coupons — niveau unitaire pur (Vitest), déterministe.
 * Couvre CPN-02 (applyCoupon), CPN-03 (selectCoupon), CPN-04
 * (computeResolvedPricing), CPN-19 (holdout déterministe).
 * Oracles exacts en centimes ; temps injecté ; aucune I/O.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCoupon,
  computeResolvedPricing,
  selectCoupon,
  selectCouponByType,
} from './engine';
import { pickBucket, bucketValue, clampHoldoutPct } from './bucketing';
import { isCandidate, isEligible, isWithinWindow } from './eligibility';
import { makeCoupon, makeContext } from '@/test/factories/coupons';

const PRICE = 28900; // 289 MAD
const PROMO = 19900; // 199 MAD

describe('CPN-02 applyCoupon (pur)', () => {
  it('U001 fixed_amount 9000 sur 28900 → 19900 (savings 9000, 31 %, framing amount)', () => {
    const r = applyCoupon(PRICE, makeCoupon({ valueKind: 'fixed_amount', valueAmount: 9000 }));
    expect(r.active).toBe(true);
    expect(r.effectivePriceCents).toBe(19900);
    expect(r.originalPriceCents).toBe(28900);
    expect(r.savingsCents).toBe(9000);
    expect(r.savingsPct).toBe(31);
    expect(r.framing).toBe('amount');
  });

  it('U002 percent 10 sur 28900 → 26010', () => {
    const r = applyCoupon(PRICE, makeCoupon({ valueKind: 'percent', valueAmount: 10 }));
    expect(r.effectivePriceCents).toBe(26010);
    expect(r.active).toBe(true);
  });

  it('U003 montant fixe = prix → candidat 0 → inactif, prix plein (jamais 0)', () => {
    const r = applyCoupon(PRICE, makeCoupon({ valueKind: 'fixed_amount', valueAmount: 28900 }));
    expect(r.active).toBe(false);
    expect(r.effectivePriceCents).toBe(28900);
  });

  it('U004 montant fixe > prix → candidat négatif → inactif, prix plein', () => {
    const r = applyCoupon(PRICE, makeCoupon({ valueKind: 'fixed_amount', valueAmount: 40000 }));
    expect(r.active).toBe(false);
    expect(r.effectivePriceCents).toBe(28900);
  });

  it('U005 percent 100 → candidat 0 → inactif', () => {
    const r = applyCoupon(PRICE, makeCoupon({ valueKind: 'percent', valueAmount: 100 }));
    expect(r.active).toBe(false);
    expect(r.effectivePriceCents).toBe(28900);
  });

  it('U006 percent 0 → candidat = prix → inactif', () => {
    const r = applyCoupon(PRICE, makeCoupon({ valueKind: 'percent', valueAmount: 0 }));
    expect(r.active).toBe(false);
  });

  it('U007 jamais d’exception sur prix non fini', () => {
    const r = applyCoupon(Number.NaN, makeCoupon({ valueAmount: 9000 }));
    expect(r.effectivePriceCents).toBe(0);
  });
});

describe('CPN-03 sélection / éligibilité / fenêtre', () => {
  const now = new Date('2026-06-02T10:00:00Z');

  it('U010 fenêtre : avant startsAt → hors fenêtre', () => {
    const c = makeCoupon({ startsAt: new Date('2026-06-03T00:00:00Z') });
    expect(isWithinWindow(c, now)).toBe(false);
  });

  it('U011 fenêtre : après endsAt → hors fenêtre', () => {
    const c = makeCoupon({ endsAt: new Date('2026-06-01T00:00:00Z') });
    expect(isWithinWindow(c, now)).toBe(false);
  });

  it('U012 fenêtre : bornes nulles → ouvert', () => {
    expect(isWithinWindow(makeCoupon(), now)).toBe(true);
  });

  it('U013 éligibilité {} → tout trafic', () => {
    expect(isEligible(makeCoupon({ eligibility: {} }), makeContext())).toBe(true);
  });

  it('U014 éligibilité trafficSources match / no-match', () => {
    const c = makeCoupon({ eligibility: { trafficSources: ['paid_social'] } });
    expect(isEligible(c, makeContext({ trafficSource: 'paid_social' }))).toBe(true);
    expect(isEligible(c, makeContext({ trafficSource: 'direct' }))).toBe(false);
    expect(isEligible(c, makeContext({ trafficSource: null }))).toBe(false);
  });

  it('U015 éligibilité device', () => {
    const c = makeCoupon({ eligibility: { devices: ['desktop'] } });
    expect(isEligible(c, makeContext({ device: 'desktop' }))).toBe(true);
    expect(isEligible(c, makeContext({ device: 'mobile' }))).toBe(false);
  });

  it('U016 isCandidate : seul status=active passe', () => {
    for (const s of ['draft', 'paused', 'archived'] as const) {
      expect(isCandidate(makeCoupon({ status: s }), makeContext(), now)).toBe(false);
    }
    expect(isCandidate(makeCoupon({ status: 'active' }), makeContext(), now)).toBe(true);
  });

  it('U017 selectCoupon : aucun candidat → null', () => {
    expect(selectCoupon([makeCoupon({ status: 'paused' })], makeContext(), now)).toBeNull();
  });

  it('U018 selectCoupon : non-cumul → priorité desc gagne', () => {
    const lo = makeCoupon({ id: 'cpn_lo', priority: 1 });
    const hi = makeCoupon({ id: 'cpn_hi', priority: 5 });
    expect(selectCoupon([lo, hi], makeContext(), now)?.id).toBe('cpn_hi');
  });

  it('U019 tie-break déterministe : priorité égale → plus ancien (createdAt) gagne, indépendant de l’ordre', () => {
    const a = makeCoupon({ id: 'cpn_b', priority: 0, createdAt: new Date('2026-01-01') });
    const b = makeCoupon({ id: 'cpn_a', priority: 0, createdAt: new Date('2026-02-01') });
    expect(selectCoupon([a, b], makeContext(), now)?.id).toBe('cpn_b');
    expect(selectCoupon([b, a], makeContext(), now)?.id).toBe('cpn_b');
  });
});

describe('CPN-04 computeResolvedPricing (composition + fallback)', () => {
  const input = { priceCents: PRICE, promoPriceCents: PROMO, currency: 'MAD', sku: 'FEMI-KIT-100' };

  it('U030 coupon actif treatment → 199, coupon!=null', () => {
    const r = computeResolvedPricing(input, makeCoupon(), makeContext());
    expect(r.effectivePriceCents).toBe(19900);
    expect(r.coupon).not.toBeNull();
    expect(r.coupon?.bucket).toBe('treatment');
  });

  it('U031 pas de coupon → fallback computePromo(289,199)=199, coupon=null', () => {
    const r = computeResolvedPricing(input, null, makeContext());
    expect(r.effectivePriceCents).toBe(19900);
    expect(r.coupon).toBeNull();
  });

  it('U032 pas de coupon + promoPriceCents null → 289 prix nu', () => {
    const r = computeResolvedPricing({ ...input, promoPriceCents: null }, null, makeContext());
    expect(r.effectivePriceCents).toBe(28900);
    expect(r.active).toBe(false);
  });

  it('U033 holdout → pas de remise coupon (fallback promo) mais coupon!=null bucket=holdout', () => {
    const r = computeResolvedPricing(
      input,
      makeCoupon({ id: 'cpn_h', holdoutPct: 100 }),
      makeContext({ visitorKey: 'vk_x' }),
    );
    expect(r.effectivePriceCents).toBe(19900); // fallback promoPriceCents
    expect(r.coupon?.bucket).toBe('holdout');
  });

  it('U034 devise incohérente → coupon ignoré (fallback), coupon=null', () => {
    const r = computeResolvedPricing(
      { ...input, currency: 'EUR' },
      makeCoupon({ currency: 'MAD' }),
      makeContext(),
    );
    expect(r.coupon).toBeNull();
  });

  it('U035 PAS de double remise : 289 - coupon = 199 (jamais 109/10900)', () => {
    const r = computeResolvedPricing(input, makeCoupon({ valueAmount: 9000 }), makeContext());
    expect(r.effectivePriceCents).toBe(19900);
    expect(r.effectivePriceCents).not.toBe(10900);
  });

  it('U036 forme PromoComputation strictement préservée', () => {
    const r = computeResolvedPricing(input, makeCoupon(), makeContext());
    expect(Object.keys(r).sort()).toEqual(
      ['active', 'coupon', 'effectivePriceCents', 'framing', 'originalPriceCents', 'savingsCents', 'savingsPct'].sort(),
    );
  });
});

describe('P2 sauvetage (rescue) — sélection par type + non-altération prix', () => {
  const now = new Date('2026-06-02T10:00:00Z');
  const input = { priceCents: PRICE, promoPriceCents: PROMO, currency: 'MAD', sku: 'FEMI-KIT-100' };

  it('R001 selectCouponByType ne retient que le type rescue actif/auto', () => {
    const welcome = makeCoupon({ id: 'w', type: 'welcome_auto' });
    const rescue = makeCoupon({ id: 'r', type: 'rescue', target: 'future_credit' });
    expect(selectCouponByType([welcome, rescue], makeContext(), now, 'rescue')?.id).toBe('r');
    expect(selectCouponByType([welcome], makeContext(), now, 'rescue')).toBeNull();
  });

  it('R002 un coupon rescue (target future_credit) n’altère JAMAIS le prix', () => {
    // computeResolvedPricing ne prend en compte que les coupons product_price.
    const rescue = makeCoupon({ type: 'rescue', target: 'future_credit', valueAmount: 1 });
    const r = computeResolvedPricing(input, rescue, makeContext());
    // target != product_price → traité comme non applicable au prix → fallback promo.
    expect(r.effectivePriceCents).toBe(19900);
    expect(r.coupon).toBeNull();
  });

  it('R003 rescue éligible seulement si actif + fenêtre + éligibilité', () => {
    const paused = makeCoupon({ type: 'rescue', status: 'paused', target: 'future_credit' });
    expect(selectCouponByType([paused], makeContext(), now, 'rescue')).toBeNull();
  });
});

describe('CPN-19 holdout déterministe', () => {
  it('U040 clampHoldoutPct borne [0,100]', () => {
    expect(clampHoldoutPct(-5)).toBe(0);
    expect(clampHoldoutPct(150)).toBe(100);
    expect(clampHoldoutPct(Number.NaN)).toBe(0);
  });

  it('U041 holdoutPct=0 → toujours treatment', () => {
    expect(pickBucket('vk_any', 'cpn_1', 0)).toBe('treatment');
  });

  it('U042 holdoutPct=100 + visitorKey → toujours holdout', () => {
    expect(pickBucket('vk_any', 'cpn_1', 100)).toBe('holdout');
  });

  it('U043 visitorKey absent → treatment (jamais holdout sans clé)', () => {
    expect(pickBucket(null, 'cpn_1', 100)).toBe('treatment');
    expect(pickBucket('', 'cpn_1', 50)).toBe('treatment');
  });

  it('U044 stabilité : même (visitorKey,couponId) → 1 seul bucket sur 10000 appels', () => {
    const set = new Set<string>();
    for (let i = 0; i < 10000; i += 1) set.add(pickBucket('vk_stable', 'cpn_1', 50));
    expect(set.size).toBe(1);
  });

  it('U045 distribution ~50/50 (±4 pts) sur clés variées', () => {
    let holdout = 0;
    const N = 5000;
    for (let i = 0; i < N; i += 1) {
      if (pickBucket(`vk_${i}`, 'cpn_1', 50) === 'holdout') holdout += 1;
    }
    const ratio = (holdout / N) * 100;
    expect(Math.abs(ratio - 50)).toBeLessThan(4);
  });

  it('U046 dépend du couponId (clé différente → potentiellement bucket différent)', () => {
    // bucketValue varie selon couponId pour une même visitorKey.
    const a = bucketValue('vk_z', 'cpn_a');
    const b = bucketValue('vk_z', 'cpn_b');
    expect(a === b && a === bucketValue('vk_z', 'cpn_c')).toBe(false);
  });
});
