/**
 * F06 — Contract GET /api/admin/coupons/[id]/stats.
 *
 * Agrégats d'incrémentalité treatment/holdout + uplift. Lecture (`read`).
 * Couvre : agrégation, noControl (holdout=0), lowSample (<100), 401/403/404.
 * memoryStore + recordCouponEvent.
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/06-api-stats.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { createCoupon } from '@/lib/db/queries/coupon-repo';
import { recordCouponEvent } from '@/lib/db/queries/coupon-event-repo';

const session = { adminId: 'adm_1', email: 'op@femiglow.local' };
let currentRole = 'admin';
let hasSession = true;

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(async () => (hasSession ? session : null)),
}));
vi.mock('@/lib/legal/permissions', async (orig) => {
  const actual = await orig<typeof import('@/lib/legal/permissions')>();
  return { ...actual, getAdminRole: vi.fn(async () => currentRole) };
});

import { GET } from './route';

beforeEach(() => {
  resetMemoryStore();
  currentRole = 'admin';
  hasSession = true;
});

function req(): Request {
  return new Request('http://localhost/api/admin/coupons/x/stats');
}

async function seedCoupon() {
  const c = await createCoupon({
    label: 'X', code: null, type: 'welcome_auto', mode: 'auto', status: 'active',
    valueKind: 'fixed_amount', valueAmount: 9000, target: 'product_price', currency: 'MAD',
    eligibility: {}, stackable: false, usageScope: 'unlimited', holdoutPct: 0, priority: 0,
  });
  return c.id;
}

async function events(couponId: string, phase: 'exposed' | 'converted', bucket: 'treatment' | 'holdout', n: number) {
  for (let i = 0; i < n; i += 1) {
    await recordCouponEvent({
      couponId, phase, bucket,
      orderId: phase === 'converted' ? `o_${bucket}_${i}` : null,
      visitorKey: `vk_${bucket}_${i}`,
    });
  }
}

describe('F06 stats route', () => {
  it('F06-I001 agrégation treatment/holdout + uplift', async () => {
    const id = await seedCoupon();
    await events(id, 'exposed', 'treatment', 200);
    await events(id, 'exposed', 'holdout', 100);
    await events(id, 'converted', 'treatment', 30); // 15%
    await events(id, 'converted', 'holdout', 10); // 10%
    const res = await GET(req(), { params: { id } });
    expect(res.status).toBe(200);
    const { stats, couponId } = await res.json();
    expect(couponId).toBe(id);
    expect(stats.exposed).toEqual({ treatment: 200, holdout: 100 });
    expect(stats.converted).toEqual({ treatment: 30, holdout: 10 });
    expect(stats.upliftAbsolute).toBeCloseTo(0.05, 5);
    expect(stats.noControl).toBe(false);
  });

  it('F06-I002 holdout=0 → noControl true', async () => {
    const id = await seedCoupon();
    await events(id, 'exposed', 'treatment', 200);
    await events(id, 'converted', 'treatment', 30);
    const { stats } = await (await GET(req(), { params: { id } })).json();
    expect(stats.noControl).toBe(true);
  });

  it('F06-I003 échantillon faible (<100) → lowSample true', async () => {
    const id = await seedCoupon();
    await events(id, 'exposed', 'treatment', 40);
    await events(id, 'exposed', 'holdout', 30);
    const { stats } = await (await GET(req(), { params: { id } })).json();
    expect(stats.lowSample).toBe(true);
  });

  it('F06-I004 coupon sans événement → agrégats à zéro, pas de crash', async () => {
    const id = await seedCoupon();
    const { stats } = await (await GET(req(), { params: { id } })).json();
    expect(stats.exposed).toEqual({ treatment: 0, holdout: 0 });
    expect(stats.upliftAbsolute).toBeNull();
  });

  it('F06-I005 sans session → 401', async () => {
    hasSession = false;
    const id = await seedCoupon();
    expect((await GET(req(), { params: { id } })).status).toBe(401);
  });

  it('F06-I006 rôle sans read (inexistant) → 403', async () => {
    currentRole = 'no_such_role';
    const id = await seedCoupon();
    expect((await GET(req(), { params: { id } })).status).toBe(403);
  });

  it('F06-I007 coupon inconnu → 404', async () => {
    expect((await GET(req(), { params: { id: 'cpn_ghost' } })).status).toBe(404);
  });

  it('F06-I008 viewer (read) autorisé → 200', async () => {
    currentRole = 'viewer';
    const id = await seedCoupon();
    expect((await GET(req(), { params: { id } })).status).toBe(200);
  });
});
