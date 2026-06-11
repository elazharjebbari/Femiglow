/**
 * F05 — Contract POST /api/admin/coupons/[id]/status.
 *
 * Transition de statut = acte de mise en ligne → permission `publish`.
 * Ordre des gardes (401 > 403 > 422 > 404), verrou « archivé non réactivable »
 * (409), effets de bord (revalidateTag x2, audit {from,to}). memoryStore.
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/05-api-status.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { createCoupon } from '@/lib/db/queries/coupon-repo';

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
vi.mock('@/lib/audit/log-event', () => ({ logAuditEvent: vi.fn(async () => undefined) }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { logAuditEvent as logAuditEventFn } from '@/lib/audit/log-event';
import { revalidateTag as revalidateTagFn } from 'next/cache';
import { POST } from './route';

const logAuditEvent = vi.mocked(logAuditEventFn);
const revalidateTag = vi.mocked(revalidateTagFn);

beforeEach(() => {
  resetMemoryStore();
  currentRole = 'admin';
  hasSession = true;
  logAuditEvent.mockClear();
  revalidateTag.mockClear();
});

function req(body: unknown): Request {
  return new Request('http://localhost/api/admin/coupons/x/status', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function seedCoupon(status = 'draft') {
  const c = await createCoupon({
    label: 'Geste', code: null, type: 'welcome_auto', mode: 'auto', status: status as never,
    valueKind: 'fixed_amount', valueAmount: 9000, target: 'product_price', currency: 'MAD',
    eligibility: {}, stackable: false, usageScope: 'unlimited', holdoutPct: 0, priority: 0,
  });
  return c.id;
}

describe('F05 status route', () => {
  it('F05-I001 publish (admin) draft→active → 200 + statut actif', async () => {
    const id = await seedCoupon('draft');
    const res = await POST(req({ status: 'active' }), { params: { id } });
    expect(res.status).toBe(200);
    expect((await res.json()).coupon.status).toBe('active');
  });

  it('F05-I002 effets de bord : revalidateTag x2 + audit {from,to}', async () => {
    const id = await seedCoupon('draft');
    await POST(req({ status: 'active' }), { params: { id } });
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'coupons.status', meta: { from: 'draft', to: 'active' } }),
    );
  });

  it('F05-I003 sans session → 401', async () => {
    hasSession = false;
    const id = await seedCoupon();
    const res = await POST(req({ status: 'active' }), { params: { id } });
    expect(res.status).toBe(401);
  });

  it('F05-I004 rôle sans publish (editor) → 403 (prime sur la validation)', async () => {
    currentRole = 'editor'; // read+write mais PAS publish
    const id = await seedCoupon();
    const res = await POST(req({ status: 'active' }), { params: { id } });
    expect(res.status).toBe(403);
  });

  it('F05-I005 statut invalide → 422 validation_failed', async () => {
    const id = await seedCoupon();
    const res = await POST(req({ status: 'banana' }), { params: { id } });
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('validation_failed');
  });

  it('F05-I006 coupon inconnu → 404', async () => {
    const res = await POST(req({ status: 'active' }), { params: { id: 'cpn_ghost' } });
    expect(res.status).toBe(404);
  });

  it('F05-I007 verrou : archivé → active = 409', async () => {
    const id = await seedCoupon('archived');
    const res = await POST(req({ status: 'active' }), { params: { id } });
    expect(res.status).toBe(409);
  });

  it('F05-I008 archivé → archivé reste autorisé (idempotent) → 200', async () => {
    const id = await seedCoupon('archived');
    const res = await POST(req({ status: 'archived' }), { params: { id } });
    expect(res.status).toBe(200);
  });

  it('F05-I009 active→paused (publish) → 200', async () => {
    const id = await seedCoupon('active');
    const res = await POST(req({ status: 'paused' }), { params: { id } });
    expect((await res.json()).coupon.status).toBe('paused');
  });

  it('F05-I010 échec (403) ne déclenche aucun effet de bord', async () => {
    currentRole = 'editor';
    const id = await seedCoupon();
    await POST(req({ status: 'active' }), { params: { id } });
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});
