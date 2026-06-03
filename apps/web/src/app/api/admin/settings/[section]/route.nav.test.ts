/**
 * N09 — Contrat PATCH /api/admin/settings/[section=nav].
 *
 * Verrou optimiste (If-Match), validation, audit, revalidateTag. Section nav.
 * cf. docs/admin-nav-coupons-qa-2026-06-03/N09.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navDefault } from '@/lib/admin-config/defaults';

const session: { adminId: string; email: string } | null = { adminId: 'adm_1', email: 'op@femiglow.ma' };
let hasSession = true;

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(async () => (hasSession ? session : null)),
}));
const logAuditEvent = vi.fn();
vi.mock('@/lib/audit/log-event', () => ({ logAuditEvent: (...a: unknown[]) => logAuditEvent(...a) }));
const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag: (...a: unknown[]) => revalidateTag(...a) }));

// upsertAppConfig pilotable.
let upsertImpl: (input: { expectedVersion: number }) => unknown;
vi.mock('@/lib/db/queries/app-config', () => ({
  upsertAppConfig: (input: { expectedVersion: number }) => upsertImpl(input),
}));

import { PATCH } from './route';

beforeEach(() => {
  hasSession = true;
  logAuditEvent.mockClear();
  revalidateTag.mockClear();
  upsertImpl = (input) => ({
    ok: true,
    row: { version: input.expectedVersion + 1, payload: navDefault, updatedAt: new Date('2026-06-03'), updatedBy: session },
    snapshot: { id: 'snap_1' },
  });
});

function patch(section: string, body: unknown, ifMatch?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (ifMatch !== undefined) headers['If-Match'] = ifMatch;
  return new Request(`http://localhost/api/admin/settings/${section}`, {
    method: 'PATCH', headers, body: JSON.stringify(body),
  });
}
const ctx = (section: string) => ({ params: { section } });

describe('N09 PATCH settings/nav', () => {
  it('N09-I001 sans session → 401', async () => {
    hasSession = false;
    const res = await PATCH(patch('nav', { payload: navDefault }, '3'), ctx('nav'));
    expect(res.status).toBe(401);
  });

  it('N09-I002 section inconnue → 404', async () => {
    const res = await PATCH(patch('nope', { payload: navDefault }, '3'), ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('N09-I003 If-Match manquant → 400 invalid_input', async () => {
    const res = await PATCH(patch('nav', { payload: navDefault }), ctx('nav'));
    expect(res.status).toBe(400);
  });

  it('N09-I004 If-Match non numérique → 400', async () => {
    const res = await PATCH(patch('nav', { payload: navDefault }, 'abc'), ctx('nav'));
    expect(res.status).toBe(400);
  });

  it('N09-I005 payload invalide → 422 validation_failed', async () => {
    const bad = { payload: { items: [{ key: 'BAD KEY', label: 'x', href: 'x', icon: '', position: -1 }] } };
    const res = await PATCH(patch('nav', bad, '3'), ctx('nav'));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('validation_failed');
  });

  it('N09-I006 version stale → 409 version_conflict (pas d’audit)', async () => {
    upsertImpl = () => ({ ok: false, currentVersion: 12 });
    const res = await PATCH(patch('nav', { payload: navDefault }, '3'), ctx('nav'));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('version_conflict');
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it('N09-I007 succès → 200 + version++ + audit + revalidateTag ×2', async () => {
    const res = await PATCH(patch('nav', { payload: navDefault }, '3'), ctx('nav'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.meta.version).toBe(4);
    expect(json.section).toBe('nav');
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'app-config.update', resourceType: 'app_config', resourceId: 'nav' }),
    );
  });

  it('N09-I008 enveloppe directe (payload non encapsulé) acceptée', async () => {
    const res = await PATCH(patch('nav', navDefault, '3'), ctx('nav'));
    expect(res.status).toBe(200);
  });
});
