/**
 * F15 — Contract POST /api/coupons/rescue : robustesse (extension).
 *
 * Complète rescue/route.test.ts (R001-R003) : log non bloquant, exception
 * moteur → show:false, déterminisme du bucket (INV-BUCKET), fallback cookie.
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/15-api-rescue.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetMemoryStore } from '@/lib/db/client';
import { createCoupon } from '@/lib/db/queries/coupon-repo';
import * as eventRepo from '@/lib/db/queries/coupon-event-repo';
import * as engine from '@/lib/coupons/engine';
import type { CouponInput } from '@/lib/coupons/schemas';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
import { POST } from './route';

beforeEach(() => resetMemoryStore());
afterEach(() => vi.restoreAllMocks());

const rescue = (holdoutPct: number): CouponInput => ({
  label: 'Sauvetage', code: null, type: 'rescue', mode: 'auto', status: 'active',
  valueKind: 'fixed_amount', valueAmount: 1, target: 'future_credit', currency: 'MAD',
  eligibility: {}, stackable: false, usageScope: 'unlimited', holdoutPct, priority: 0,
});

function req(opts: { session?: string; fbp?: string; none?: boolean } = {}): NextRequest {
  const headers: Record<string, string> = { 'user-agent': 'iPhone' };
  if (!opts.none) {
    const cookie = opts.fbp ? `_fbp=${opts.fbp}` : `fg_session_id=${opts.session ?? 'sess-1'}`;
    headers.cookie = cookie;
  }
  return new NextRequest('http://localhost/api/coupons/rescue', { method: 'POST', headers });
}

describe('F15 rescue robustesse', () => {
  it('F15-I001 log qui échoue → réponse inchangée (non bloquant)', async () => {
    await createCoupon(rescue(0)); // treatment → show:true
    vi.spyOn(eventRepo, 'recordCouponEvent').mockRejectedValueOnce(new Error('db down'));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).show).toBe(true);
  });

  it('F15-I002 exception moteur → show:false (jamais d’erreur visible)', async () => {
    vi.spyOn(engine, 'resolveRescueCoupon').mockRejectedValueOnce(new Error('boom'));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).show).toBe(false);
  });

  it('F15-I003 déterminisme : même session → décision stable sur 3 appels', async () => {
    await createCoupon(rescue(50));
    const shows: boolean[] = [];
    for (let i = 0; i < 3; i += 1) {
      shows.push((await (await POST(req({ session: 'stable-key' }))).json()).show);
    }
    expect(new Set(shows).size).toBe(1); // pas de bascule
  });

  it('F15-I004 fallback cookie _fbp (sans fg_session_id)', async () => {
    await createCoupon(rescue(0));
    const res = await POST(req({ fbp: 'fb.1.123.456' }));
    expect((await res.json()).show).toBe(true);
  });

  it('F15-I005 sans cookie du tout → pas de crash, décision défensive', async () => {
    await createCoupon(rescue(0));
    const res = await POST(req({ none: true }));
    expect(res.status).toBe(200);
    expect(typeof (await res.json()).show).toBe('boolean');
  });
});
