/**
 * Contract test POST /api/coupons/rescue (Phase 2).
 * Le serveur décide le bucket et journalise l'exposition ; renvoie `show`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetMemoryStore } from '@/lib/db/client';
import { createCoupon } from '@/lib/db/queries/coupon-repo';
import { countByPhaseAndBucket } from '@/lib/db/queries/coupon-event-repo';
import type { CouponInput } from '@/lib/coupons/schemas';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
import { POST } from './route';

beforeEach(() => resetMemoryStore());

const rescue = (holdoutPct: number): CouponInput => ({
  label: 'Sauvetage', code: null, type: 'rescue', mode: 'auto', status: 'active',
  valueKind: 'fixed_amount', valueAmount: 1, target: 'future_credit', currency: 'MAD',
  eligibility: {}, stackable: false, usageScope: 'unlimited', holdoutPct, priority: 0,
});

function req(session = 'sess-1'): NextRequest {
  return new NextRequest('http://localhost/api/coupons/rescue', {
    method: 'POST',
    headers: { cookie: `fg_session_id=${session}`, 'user-agent': 'iPhone' },
  });
}

describe('P2 /api/coupons/rescue', () => {
  it('R001 pas de coupon rescue actif → show:false', async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).show).toBe(false);
  });

  it('R002 holdout=0 → treatment → show:true + exposition journalisée', async () => {
    await createCoupon(rescue(0));
    const res = await POST(req());
    const body = await res.json();
    expect(body.show).toBe(true);
    // exposition existe (treatment)
    const all = await countByPhaseAndBucketAny();
    expect(all.some((c) => c.phase === 'exposed' && c.bucket === 'treatment')).toBe(true);
  });

  it('R003 holdout=100 → holdout → show:false mais exposition journalisée (contrôle)', async () => {
    await createCoupon(rescue(100));
    const res = await POST(req('sess-control'));
    expect((await res.json()).show).toBe(false);
    const all = await countByPhaseAndBucketAny();
    expect(all.some((c) => c.phase === 'exposed' && c.bucket === 'holdout')).toBe(true);
  });
});

// Helper : agrège sur le seul coupon présent en mémoire.
async function countByPhaseAndBucketAny() {
  const { listCoupons } = await import('@/lib/db/queries/coupon-repo');
  const c = (await listCoupons({ type: 'rescue' }))[0];
  return c ? countByPhaseAndBucket(c.id) : [];
}
