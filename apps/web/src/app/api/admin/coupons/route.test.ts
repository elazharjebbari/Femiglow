/**
 * Contract tests routes /api/admin/coupons — CPN-10 / CPN-13.
 * Auth → permission (403 prime) → validation (422). Repo en memoryStore.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';

const session = { adminId: 'adm_1', email: 'op@femiglow.local' };
let currentRole = 'admin';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(async () => session),
}));
vi.mock('@/lib/legal/permissions', async (orig) => {
  const actual = await orig<typeof import('@/lib/legal/permissions')>();
  return { ...actual, getAdminRole: vi.fn(async () => currentRole) };
});
vi.mock('@/lib/audit/log-event', () => ({ logAuditEvent: vi.fn(async () => undefined) }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { GET, POST } from './route';

beforeEach(() => {
  resetMemoryStore();
  currentRole = 'admin';
});

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/admin/coupons', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  label: 'Geste d’accueil',
  type: 'welcome_auto',
  mode: 'auto',
  status: 'draft',
  valueKind: 'fixed_amount',
  valueAmount: 9000,
  target: 'product_price',
  currency: 'MAD',
};

describe('CPN-13 RBAC', () => {
  it('C001 viewer (read seul) → POST 403', async () => {
    currentRole = 'viewer';
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(403);
  });

  it('C002 admin (write) → POST 201', async () => {
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
  });

  it('C003 viewer → GET 200 (lecture autorisée)', async () => {
    currentRole = 'viewer';
    const res = await GET(new Request('http://localhost/api/admin/coupons'));
    expect(res.status).toBe(200);
  });
});

describe('CPN-10 validation', () => {
  it('C010 payload invalide (valueAmount négatif) → 422', async () => {
    const res = await POST(postReq({ ...validBody, valueAmount: -5 }));
    expect(res.status).toBe(422);
  });

  it('C011 mode auto avec code → 422', async () => {
    const res = await POST(postReq({ ...validBody, mode: 'auto', code: 'X' }));
    expect(res.status).toBe(422);
  });

  it('C012 code dupliqué → 409', async () => {
    const withCode = { ...validBody, mode: 'code', code: 'INVITE10' };
    expect((await POST(postReq(withCode))).status).toBe(201);
    expect((await POST(postReq(withCode))).status).toBe(409);
  });
});
