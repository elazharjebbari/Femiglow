/**
 * Tests repo coupons (memoryStore) — CPN-01 / CPN-10 (socle).
 * Isolation via resetMemoryStore().
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  DuplicateCouponCodeError,
  createCoupon,
  getCouponById,
  incrementUsage,
  listAutoCoupons,
  listCoupons,
  setCouponStatus,
  updateCoupon,
} from './coupon-repo';
import type { CouponInput } from '@/lib/coupons/schemas';

beforeEach(() => resetMemoryStore());

const baseInput: CouponInput = {
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
  stackable: false,
  usageScope: 'unlimited',
  holdoutPct: 0,
  priority: 0,
};

describe('CPN-01 createCoupon / read', () => {
  it('C001 crée et relit un coupon (valeurs exactes)', async () => {
    const c = await createCoupon(baseInput);
    expect(c.id).toMatch(/^cpn_/);
    expect(c.valueAmount).toBe(9000);
    const read = await getCouponById(c.id);
    expect(read?.label).toBe('Geste d’accueil');
  });

  it('C002 listAutoCoupons ne renvoie que les coupons mode=auto', async () => {
    await createCoupon(baseInput);
    await createCoupon({ ...baseInput, mode: 'code', code: 'INVITE10' });
    const auto = await listAutoCoupons();
    expect(auto).toHaveLength(1);
    expect(auto[0]?.mode).toBe('auto');
  });

  it('C003 code dupliqué → DuplicateCouponCodeError', async () => {
    await createCoupon({ ...baseInput, mode: 'code', code: 'INVITE10' });
    await expect(
      createCoupon({ ...baseInput, mode: 'code', code: 'INVITE10' }),
    ).rejects.toBeInstanceOf(DuplicateCouponCodeError);
  });
});

describe('CPN-10 update / status / usage', () => {
  it('C010 update modifie les champs fournis', async () => {
    const c = await createCoupon(baseInput);
    const up = await updateCoupon(c.id, { valueAmount: 5000, priority: 3 });
    expect(up?.valueAmount).toBe(5000);
    expect(up?.priority).toBe(3);
  });

  it('C011 setCouponStatus pause → status paused', async () => {
    const c = await createCoupon(baseInput);
    const paused = await setCouponStatus(c.id, 'paused');
    expect(paused?.status).toBe('paused');
  });

  it('C012 listCoupons filtre par status', async () => {
    await createCoupon(baseInput);
    await createCoupon({ ...baseInput, status: 'draft' });
    expect(await listCoupons({ status: 'active' })).toHaveLength(1);
    expect(await listCoupons({ status: 'draft' })).toHaveLength(1);
  });

  it('C013 incrementUsage incrémente le compteur', async () => {
    const c = await createCoupon(baseInput);
    await incrementUsage(c.id);
    await incrementUsage(c.id);
    expect((await getCouponById(c.id))?.usageCount).toBe(2);
  });

  it('C014 update inexistant → null', async () => {
    expect(await updateCoupon('cpn_nope', { priority: 1 })).toBeNull();
  });
});
