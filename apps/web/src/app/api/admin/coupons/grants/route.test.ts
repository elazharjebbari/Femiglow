/** Contract — GET /api/admin/coupons/grants (LOY-G6) : auth, RBAC, masquage. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { issueGrant } from '@/lib/db/queries/coupon-grant-repo';

const session = { adminId: 'adm_1', email: 'op@femiglow.local' };
let role = 'admin';

vi.mock('@/lib/auth/require-admin', () => ({ getAdminSession: vi.fn(async () => session) }));
vi.mock('@/lib/legal/permissions', async (orig) => {
  const actual = await orig<typeof import('@/lib/legal/permissions')>();
  return { ...actual, getAdminRole: vi.fn(async () => role) };
});

import { GET } from './route';

beforeEach(() => {
  resetMemoryStore();
  role = 'admin';
});

function req(qs = ''): Request {
  return new Request(`http://localhost/api/admin/coupons/grants${qs}`);
}

describe('LOY-G6 grants route', () => {
  it('C001 liste les codes émis avec téléphone MASQUÉ', async () => {
    await issueGrant({
      templateCouponId: 'cpn_tpl', leadId: 'l1', sourceOrderId: 'o_1',
      valueCents: 2000, phoneE164: '+212612345678', activatesAt: new Date('2026-07-01'),
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].phone).not.toContain('612345'); // masqué
    expect(json.items[0].phone).toMatch(/…/);
    expect(json.items[0].code).toMatch(/^FG-/);
  });

  it('C002 filtre par téléphone', async () => {
    await issueGrant({ templateCouponId: 't', leadId: 'l1', sourceOrderId: 'o_1', valueCents: 2000, phoneE164: '+212600000001' });
    await issueGrant({ templateCouponId: 't', leadId: 'l2', sourceOrderId: 'o_2', valueCents: 2000, phoneE164: '+212600000002' });
    const res = await GET(req('?phone=%2B212600000001'));
    const json = await res.json();
    expect(json.items).toHaveLength(1);
  });

  it('C003 RBAC : rôle sans droit coupons → 403', async () => {
    role = 'viewer'; // viewer a coupons:read → autorisé ; on force un rôle inexistant
    // viewer EST autorisé en lecture ; on teste plutôt un rôle vide.
    role = 'no_such_role';
    const res = await GET(req());
    expect(res.status).toBe(403);
  });
});
