/**
 * Tests du seed welcome_auto — CPN-20 (idempotence, valeurs, D-2).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { listCoupons, setCouponStatus } from '@/lib/db/queries/coupon-repo';
import { resolveProductPricing } from '@/lib/coupons/engine';
import { runCouponsSeed } from './seed-coupons';
import { makeContext } from '@/test/factories/coupons';

beforeEach(() => resetMemoryStore());

describe('CPN-20 seed welcome_auto', () => {
  it('U001 crée welcome (9000), rescue (holdout 20) et fidélité (post_purchase)', async () => {
    const r = await runCouponsSeed();
    expect(r.created).toBe(3);
    const w = (await listCoupons({ type: 'welcome_auto' }))[0];
    expect(w?.status).toBe('active');
    expect(w?.valueAmount).toBe(9000);
    const resc = (await listCoupons({ type: 'rescue' }))[0];
    expect(resc?.holdoutPct).toBe(20);
    expect(resc?.target).toBe('future_credit');
    const loyal = (await listCoupons({ type: 'post_purchase' }))[0];
    expect(loyal?.status).toBe('active');
    expect(loyal?.stackable).toBe(true); // cumulable avec l'accueil
    expect(loyal?.valueAmount).toBe(2000);
  });

  it('U002 idempotent : 2e run ne crée pas de doublon', async () => {
    await runCouponsSeed();
    const r2 = await runCouponsSeed();
    expect(r2.created).toBe(0);
    expect(r2.updated).toBe(3);
    expect(await listCoupons({ type: 'welcome_auto' })).toHaveLength(1);
    expect(await listCoupons({ type: 'rescue' })).toHaveLength(1);
    expect(await listCoupons({ type: 'post_purchase' })).toHaveLength(1);
  });

  it('U003 préserve le status paused au re-seed (D-2)', async () => {
    const r = await runCouponsSeed();
    await setCouponStatus(r.couponId, 'paused');
    await runCouponsSeed();
    const c = (await listCoupons({ type: 'welcome_auto' }))[0];
    expect(c?.status).toBe('paused');
  });

  it('U004 après seed, le moteur produit bien 289 → 199', async () => {
    await runCouponsSeed();
    const r = await resolveProductPricing(
      { priceCents: 28900, promoPriceCents: null, currency: 'MAD', sku: 'FEMI-KIT-100' },
      makeContext(),
    );
    expect(r.effectivePriceCents).toBe(19900);
    expect(r.coupon?.type).toBe('welcome_auto');
  });
});
