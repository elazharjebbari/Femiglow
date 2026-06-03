/**
 * F19 — Intégration pricing : parité prix affiché == prix facturé.
 *
 * Couche I (Vitest pur + memoryStore + horloge injectée). Verrouille au point
 * d'intégration l'invariant central : le prix résolu pour l'affichage est
 * exactement celui recalculé au checkout (anti-422), avec holdout déterministe,
 * éligibilité-en-contexte et non-cumul/tie-break.
 *
 * Source unique : resolveProductPricing (engine) = selectCoupon +
 * computeResolvedPricing. Les oracles s'appuient sur les VRAIES fonctions.
 *
 * NB : la forme de sortie est `PromoComputation` → le champ « prix final » est
 * `effectivePriceCents` (pas `finalPriceCents`, qui n'existe pas dans le type).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import {
  applyCoupon,
  computeResolvedPricing,
  resolveProductPricing,
  selectCoupon,
} from './engine';
import { pickBucket } from './bucketing';
import type { CouponContext, CouponDef, PricingInput } from './types';
import { PriceMismatchError } from '@/lib/checkout/repos/order-repo';
import fixtures from './__fixtures__/pricing-integration.fixtures.json';

beforeEach(() => resetMemoryStore());

const NOW = new Date(fixtures.now.inside);

const KIT: PricingInput = {
  priceCents: fixtures.input.kit.priceCents,
  promoPriceCents: fixtures.input.kit.promoPriceCents,
  sku: fixtures.input.kit.sku,
  currency: fixtures.input.kit.currency,
};
const LEGACY: PricingInput = {
  priceCents: fixtures.input.legacyPromo.priceCents,
  promoPriceCents: fixtures.input.legacyPromo.promoPriceCents,
  sku: fixtures.input.legacyPromo.sku,
  currency: fixtures.input.legacyPromo.currency,
};

/**
 * Normalise une fixture coupon (type maison « welcome ») vers le `CouponType`
 * réel du domaine (`welcome_auto`) + dates Date. Les fixtures emploient des
 * libellés de type non typés ; on mappe vers les valeurs réelles.
 */
function toDef(raw: Record<string, unknown>): CouponDef {
  const typeMap: Record<string, CouponDef['type']> = {
    welcome: 'welcome_auto',
    rescue: 'rescue',
  };
  return {
    id: raw.id as string,
    label: raw.label as string,
    code: (raw.code as string | null) ?? null,
    type: typeMap[raw.type as string] ?? (raw.type as CouponDef['type']),
    mode: raw.mode as CouponDef['mode'],
    status: raw.status as CouponDef['status'],
    valueKind: raw.valueKind as CouponDef['valueKind'],
    valueAmount: raw.valueAmount as number,
    // La fixture rescueTarget porte target:'rescue' (libellé non typé) → on le
    // mappe sur un target non-prix réel (`future_credit`) pour exercer la garde.
    target:
      raw.target === 'rescue'
        ? 'future_credit'
        : (raw.target as CouponDef['target']),
    currency: raw.currency as string,
    eligibility: (raw.eligibility ?? {}) as CouponDef['eligibility'],
    startsAt: raw.startsAt ? new Date(raw.startsAt as string) : null,
    endsAt: raw.endsAt ? new Date(raw.endsAt as string) : null,
    stackable: raw.stackable as boolean,
    usageScope: (raw.usageScope === 'global'
      ? 'unlimited'
      : (raw.usageScope as CouponDef['usageScope'])) as CouponDef['usageScope'],
    usageCap: (raw.usageCap as number | null) ?? null,
    usageCount: (raw.usageCount as number) ?? 0,
    holdoutPct: raw.holdoutPct as number,
    priority: raw.priority as number,
    createdAt: new Date(raw.createdAt as string),
  };
}

function ctx(name: keyof typeof fixtures.contexts): CouponContext {
  const c = fixtures.contexts[name] as Record<string, unknown>;
  return {
    visitorKey: (c.visitorKey as string | null) ?? null,
    trafficSource: (c.trafficSource as string | null) ?? null,
    device: c.device as CouponContext['device'],
    now: new Date(c.now as string),
  };
}

/** Seed le memoryStore pour que resolveProductPricing charge ces coupons. */
function seedCoupons(defs: CouponDef[]): void {
  const store = memoryStore() as unknown as { coupons?: Map<string, unknown> };
  if (!store.coupons) store.coupons = new Map();
  for (const d of defs) {
    store.coupons.set(d.id, {
      ...d,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      createdAt: d.createdAt,
      updatedAt: d.createdAt,
      createdBy: null,
    });
  }
}

describe('F19 parité tri-points + source unique (INV-PRICE)', () => {
  it('F19-I001 parité affichage/snapshot/order : 3 appels identiques → sorties strictement égales', async () => {
    seedCoupons([toDef(fixtures.coupons.welcome)]);
    const context = ctx('treatment');
    const a = await resolveProductPricing(KIT, context);
    const b = await resolveProductPricing(KIT, context);
    const c = await resolveProductPricing(KIT, context);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a.effectivePriceCents).toBe(b.effectivePriceCents);
    expect(a.active).toBe(b.active);
    expect(a.coupon?.bucket).toBe(c.coupon?.bucket);
  });

  it('F19-I002 treatment applique la remise (fixed 90 MAD → 109 MAD)', async () => {
    seedCoupons([toDef(fixtures.coupons.welcome)]);
    const r = await resolveProductPricing(KIT, ctx('treatment'));
    expect(r.active).toBe(true);
    expect(r.effectivePriceCents).toBe(fixtures.expected.welcomeFinalCents); // 10900
    expect(r.coupon?.bucket).toBe('treatment');
  });

  it('F19-I003 holdout : ref conservée mais prix plein', async () => {
    seedCoupons([toDef(fixtures.coupons.welcomeHoldout)]);
    const r = await resolveProductPricing(KIT, ctx('holdout'));
    expect(r.active).toBe(false);
    expect(r.effectivePriceCents).toBe(fixtures.expected.fullPriceCents); // 19900
    expect(r.coupon?.bucket).toBe('holdout');
  });

  it('F19-I004 bucket déterministe et stable affichage vs checkout', async () => {
    const coupon = toDef(fixtures.coupons.welcome);
    const c = fixtures.contexts.stable;
    const set = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      set.add(pickBucket(c.visitorKey, coupon.id, 50));
    }
    expect(set.size).toBe(1);
    // Même coupon.bucket aux deux points de résolution (affichage puis checkout).
    seedCoupons([toDef({ ...fixtures.coupons.welcome, holdoutPct: 50 })]);
    const display = await resolveProductPricing(KIT, ctx('stable'));
    const checkout = await resolveProductPricing(KIT, ctx('stable'));
    expect(display.coupon?.bucket).toBe(checkout.coupon?.bucket);
  });

  it('F19-I005 visitorKey absent → treatment imposé', async () => {
    seedCoupons([toDef(fixtures.coupons.welcomeHoldout)]);
    const r = await resolveProductPricing(KIT, ctx('noKey'));
    expect(r.coupon?.bucket).toBe('treatment');
    expect(r.active).toBe(true);
  });

  it('F19-I006 holdoutPct=0 → toujours treatment', async () => {
    seedCoupons([toDef(fixtures.coupons.welcome)]);
    const r = await resolveProductPricing(KIT, ctx('treatment'));
    expect(r.coupon?.bucket).toBe('treatment');
    expect(r.active).toBe(true);
  });
});

describe('F19 éligibilité-en-contexte (INV-PRICE)', () => {
  it('F19-I007 trafficSource exigée absente du contexte → exclu, prix plein', async () => {
    const coupon = toDef(fixtures.coupons.metaOnly);
    expect(selectCoupon([coupon], ctx('noSource'), NOW)).toBeNull();
    seedCoupons([coupon]);
    const r = await resolveProductPricing(KIT, ctx('noSource'));
    expect(r.coupon).toBeNull();
    expect(r.active).toBe(false);
  });

  it('F19-I008 éligibilité satisfaite en contexte → coupon retenu, remise appliquée', async () => {
    const coupon = toDef(fixtures.coupons.metaOnly);
    const selected = selectCoupon([coupon], ctx('meta'), NOW);
    expect(selected?.id).toBe('cpn_meta');
    seedCoupons([coupon]);
    const r = await resolveProductPricing(KIT, ctx('meta'));
    expect(r.active).toBe(true);
    expect(r.coupon?.id).toBe('cpn_meta');
    expect(r.effectivePriceCents).toBe(fixtures.expected.metaFinalCents); // 14900
  });

  it('F19-I009 coupon hors fenêtre → aucun candidat', () => {
    const coupon = toDef(fixtures.coupons.window);
    const outside = new Date(fixtures.now.outside);
    expect(selectCoupon([coupon], ctx('treatment'), outside)).toBeNull();
  });

  it('F19-I010 coupon non actif (paused) → aucun candidat', () => {
    const coupon = toDef(fixtures.coupons.paused);
    expect(selectCoupon([coupon], ctx('treatment'), NOW)).toBeNull();
  });

  it('F19-I011 devise coupon différente → ignorée, fallback, coupon null', () => {
    const coupon = toDef(fixtures.coupons.eur);
    const r = computeResolvedPricing(KIT, coupon, ctx('treatment'));
    expect(r.active).toBe(false);
    expect(r.coupon).toBeNull();
    expect(r.effectivePriceCents).toBe(fixtures.expected.fullPriceCents);
  });
});

describe('F19 plancher & gardes non-prix (INV-PRICE / INV-NONCUMUL)', () => {
  it('F19-I012 applyCoupon jamais négatif (fixed > prix)', () => {
    const coupon = toDef(fixtures.coupons.overFixed);
    const r = applyCoupon(KIT.priceCents, coupon);
    expect(r.active).toBe(false);
    expect(r.effectivePriceCents).toBe(fixtures.expected.fullPriceCents);
    expect(r.effectivePriceCents).toBeGreaterThanOrEqual(0);
  });

  it('F19-I013 percent=100 → inactive, prix plein', () => {
    const coupon = toDef(fixtures.coupons.pct100);
    const r = applyCoupon(KIT.priceCents, coupon);
    expect(r.active).toBe(false);
    expect(r.effectivePriceCents).toBe(fixtures.expected.fullPriceCents);
  });

  it('F19-I014 percent=0 → inactive', () => {
    const coupon = toDef(fixtures.coupons.pct0);
    const r = applyCoupon(KIT.priceCents, coupon);
    expect(r.active).toBe(false);
    expect(r.effectivePriceCents).toBe(fixtures.expected.fullPriceCents);
  });

  it('F19-I015 coupon non-prix passé par erreur → ignoré, prix plein, coupon null', () => {
    const coupon = toDef(fixtures.coupons.rescueTarget); // target → future_credit
    const r = computeResolvedPricing(KIT, coupon, ctx('treatment'));
    expect(r.active).toBe(false);
    expect(r.coupon).toBeNull();
    expect(r.effectivePriceCents).toBe(fixtures.expected.fullPriceCents);
  });
});

describe('F19 non-cumul + tie-break (INV-NONCUMUL)', () => {
  it('F19-I016 priorité desc gagne', () => {
    const defs = (fixtures.coupons.tiePriority as Record<string, unknown>[]).map(toDef);
    expect(selectCoupon(defs, ctx('treatment'), NOW)?.id).toBe('cpn_hi');
  });

  it('F19-I017 createdAt asc gagne à priorité égale', () => {
    const defs = (fixtures.coupons.tieAge as Record<string, unknown>[]).map(toDef);
    expect(selectCoupon(defs, ctx('treatment'), NOW)?.id).toBe('cpn_old');
    // indépendant de l'ordre d'entrée
    expect(selectCoupon([...defs].reverse(), ctx('treatment'), NOW)?.id).toBe('cpn_old');
  });

  it('F19-I018 id asc gagne à priorité+age égaux', () => {
    const defs = (fixtures.coupons.tieId as Record<string, unknown>[]).map(toDef);
    expect(selectCoupon(defs, ctx('treatment'), NOW)?.id).toBe('cpn_a');
    expect(selectCoupon([...defs].reverse(), ctx('treatment'), NOW)?.id).toBe('cpn_a');
  });

  it('F19-I019 un seul coupon prix appliqué au final (gagnant tie-break)', async () => {
    const defs = (fixtures.coupons.tiePriority as Record<string, unknown>[]).map(toDef);
    seedCoupons(defs);
    const winner = selectCoupon(defs, ctx('treatment'), NOW);
    const r = await resolveProductPricing(KIT, ctx('treatment'));
    expect(r.coupon?.id).toBe(winner?.id); // cpn_hi
    // remise calculée depuis ce seul coupon (90 MAD) → 109 MAD, pas de cumul
    expect(r.effectivePriceCents).toBe(fixtures.expected.welcomeFinalCents);
  });
});

describe('F19 anti-422 (INV-422)', () => {
  /**
   * Le contrat anti-422 vit dans order-repo : `computedTotal` (issu de
   * resolveProductPricing) comparé à `expectedTotalCents` ; tout écart →
   * PriceMismatchError → code 'price_mismatch' → HTTP 422 (STATUS_BY_CODE).
   * On exerce la VRAIE classe et l'équation de garde, source unique respectée.
   */
  function guardOrThrow(computedTotal: number, expectedTotalCents: number): void {
    if (computedTotal !== expectedTotalCents) {
      throw new PriceMismatchError(expectedTotalCents, computedTotal);
    }
  }

  it('F19-I020 expectedTotalCents aligné → pas de mismatch', async () => {
    seedCoupons([toDef(fixtures.coupons.welcome)]);
    const resolved = await resolveProductPricing(KIT, ctx('treatment'));
    const computedTotal = resolved.effectivePriceCents;
    expect(computedTotal).toBe(fixtures.order.aligned.resolvedTotalCents);
    expect(() => guardOrThrow(computedTotal, fixtures.order.aligned.expectedTotalCents)).not.toThrow();
  });

  it('F19-I021 expectedTotalCents divergent (UI stale) → PriceMismatchError → 422 price_mismatch', async () => {
    seedCoupons([toDef(fixtures.coupons.welcome)]);
    const resolved = await resolveProductPricing(KIT, ctx('treatment'));
    const computedTotal = resolved.effectivePriceCents; // 10900
    let caught: unknown;
    try {
      guardOrThrow(computedTotal, fixtures.order.mismatch.expectedTotalCents); // 19900
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PriceMismatchError);
    expect((caught as PriceMismatchError).details).toEqual({
      expectedTotalCents: 19900,
      computedTotalCents: 10900,
    });
    // mapping code→statut (response.ts) : price_mismatch === 422
    expect((caught as PriceMismatchError).name).toBe('PriceMismatchError');
  });

  it('F19-I023 parité prix entre affichage et recalcul order (109 MAD aux deux points)', async () => {
    seedCoupons([toDef(fixtures.coupons.welcome)]);
    const display = await resolveProductPricing(KIT, ctx('treatment'));
    const order = await resolveProductPricing(KIT, ctx('treatment'));
    expect(display.effectivePriceCents).toBe(fixtures.expected.welcomeFinalCents);
    expect(order.effectivePriceCents).toBe(fixtures.expected.welcomeFinalCents);
    expect(display.effectivePriceCents).toBe(order.effectivePriceCents);
  });
});

describe('F19 fallback sans coupon (INV-PRICE)', () => {
  it('F19-I022 aucun coupon éligible → fallback computePromo legacy, coupon null', async () => {
    // store coupons vide → listAutoCoupons renvoie [] → selectCoupon null.
    const r = await resolveProductPricing(LEGACY, ctx('treatment'));
    expect(r.coupon).toBeNull();
    expect(r.effectivePriceCents).toBe(fixtures.expected.legacyPromoCents); // 14900
  });
});
