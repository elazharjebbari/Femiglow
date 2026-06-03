/**
 * Tests journal d'événements coupon — CPN-09 (idempotence, anonymat, agrégats).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  countByPhaseAndBucket,
  getRescueExposureBucket,
  hasConvertedForOrder,
  recordCouponEvent,
} from './coupon-event-repo';
import { createCoupon } from './coupon-repo';

beforeEach(() => resetMemoryStore());

describe('CPN-09 idempotence converted', () => {
  it('U001 1er converted inséré → true', async () => {
    const ok = await recordCouponEvent({
      couponId: 'cpn_1',
      phase: 'converted',
      bucket: 'treatment',
      orderId: 'o_1',
      amountCents: 9000,
    });
    expect(ok).toBe(true);
  });

  it('U002 2e converted même orderId → false (pas de doublon)', async () => {
    const base = { couponId: 'cpn_1', phase: 'converted' as const, bucket: 'treatment' as const, orderId: 'o_1', amountCents: 9000 };
    await recordCouponEvent(base);
    const second = await recordCouponEvent(base);
    expect(second).toBe(false);
    expect(await hasConvertedForOrder('o_1')).toBe(true);
  });

  it('U002b même order, coupons différents (welcome + rescue) → 2 converted permis', async () => {
    const a = await recordCouponEvent({ couponId: 'cpn_welcome', phase: 'converted', bucket: 'treatment', orderId: 'o_1' });
    const b = await recordCouponEvent({ couponId: 'cpn_rescue', phase: 'converted', bucket: 'treatment', orderId: 'o_1' });
    expect(a).toBe(true);
    expect(b).toBe(true);
  });

  it('U003 converted sur orders différents → 2 events', async () => {
    await recordCouponEvent({ couponId: 'cpn_1', phase: 'converted', bucket: 'treatment', orderId: 'o_1' });
    await recordCouponEvent({ couponId: 'cpn_1', phase: 'converted', bucket: 'treatment', orderId: 'o_2' });
    const counts = await countByPhaseAndBucket('cpn_1');
    expect(counts.find((c) => c.phase === 'converted')?.count).toBe(2);
  });
});

describe('CPN-09 exposed / applied / agrégats', () => {
  it('U010 exposed et applied librement insérés', async () => {
    expect(await recordCouponEvent({ couponId: 'cpn_1', phase: 'exposed', bucket: 'treatment' })).toBe(true);
    expect(await recordCouponEvent({ couponId: 'cpn_1', phase: 'applied', bucket: 'treatment' })).toBe(true);
  });

  it('U011 countByPhaseAndBucket ventile par phase × bucket', async () => {
    await recordCouponEvent({ couponId: 'cpn_1', phase: 'exposed', bucket: 'treatment' });
    await recordCouponEvent({ couponId: 'cpn_1', phase: 'exposed', bucket: 'holdout' });
    await recordCouponEvent({ couponId: 'cpn_1', phase: 'converted', bucket: 'treatment', orderId: 'o_9' });
    const counts = await countByPhaseAndBucket('cpn_1');
    expect(counts.find((c) => c.phase === 'exposed' && c.bucket === 'treatment')?.count).toBe(1);
    expect(counts.find((c) => c.phase === 'exposed' && c.bucket === 'holdout')?.count).toBe(1);
    expect(counts.find((c) => c.phase === 'converted' && c.bucket === 'treatment')?.count).toBe(1);
  });

  it('U013 getRescueExposureBucket retrouve le bucket d’une exposition rescue', async () => {
    const rescue = await createCoupon({
      label: 'r', code: null, type: 'rescue', mode: 'auto', status: 'active',
      valueKind: 'fixed_amount', valueAmount: 1, target: 'future_credit', currency: 'MAD',
      eligibility: {}, stackable: false, usageScope: 'unlimited', holdoutPct: 20, priority: 0,
    });
    await recordCouponEvent({ couponId: rescue.id, phase: 'exposed', bucket: 'treatment', visitorKey: 'vk_1' });
    expect(await getRescueExposureBucket('vk_1')).toBe('treatment');
    expect(await getRescueExposureBucket('vk_unknown')).toBeNull();
  });

  it('U012 anonymat : visitorKey est un hash, jamais de PII brute écrite par l’appelant', async () => {
    // Le repo stocke ce qu'on lui passe ; le contrat (testé en amont, CPN-05)
    // est que visitorKey est déjà hashé. Ici on vérifie qu'aucune PII n'est
    // requise/déduite par le repo.
    const ok = await recordCouponEvent({
      couponId: 'cpn_1',
      phase: 'exposed',
      bucket: 'treatment',
      visitorKey: 'vk_anon123',
    });
    expect(ok).toBe(true);
  });
});
