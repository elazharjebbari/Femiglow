/**
 * Integration tests for POST/GET /api/mail/unsubscribe?t=<token>.
 *
 * Verifies :
 *   - missing / invalid token → 400 (POST: text, GET: HTML)
 *   - POST valid token → suppression INSERT + subscriber_link UPDATE in one tx
 *   - POST returns JSON, GET returns HTML
 *   - UX-PUB-004 : GET valid token est NON DESTRUCTIF → page de confirmation,
 *     AUCUNE écriture DB (la suppression n'a lieu qu'au POST).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/mail/rate-limit', () => ({
  enforceMailRateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/mail/unsub-token', () => ({
  verifyUnsubToken: vi.fn(),
}));
vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { POST, GET } from '../route';
import { verifyUnsubToken } from '@/lib/mail/unsub-token';
import { db as getDb } from '@/lib/db/client';

function makeReq(method: 'GET' | 'POST', token?: string): Request {
  const url = token === undefined
    ? 'http://test/api/mail/unsubscribe'
    : `http://test/api/mail/unsubscribe?t=${encodeURIComponent(token)}`;
  return new Request(url, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/mail/unsubscribe', () => {
  it('returns 400 without token', async () => {
    const res = await POST(makeReq('POST') as never);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('missing-token');
  });

  it('returns 400 with invalid token', async () => {
    vi.mocked(verifyUnsubToken).mockReturnValue(null);
    const res = await POST(makeReq('POST', 'bad') as never);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('invalid-or-expired');
  });

  it('happy path : INSERT suppression + UPDATE subscriber, returns 200 JSON', async () => {
    vi.mocked(verifyUnsubToken).mockReturnValue('bye@example.com');
    const drizzle = makeFakeDrizzle();
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const res = await POST(makeReq('POST', 'good') as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ ok: true });
    // Suppression row inserted
    expect(drizzle.calls.insert).toHaveLength(1);
    expect(drizzle.calls.insert[0]!.values).toMatchObject({
      email: 'bye@example.com',
      reason: 'unsubscribe',
      source: 'manual',
    });
    expect(drizzle.calls.insert[0]!.onConflict).toBe('doNothing');
    // Subscriber link updated to disabled
    expect(drizzle.calls.update).toHaveLength(1);
    const set = drizzle.calls.update[0]!.set as Record<string, unknown>;
    expect(set.status).toBe('disabled');
    expect(set.unsubscribedAt).toBeInstanceOf(Date);
  });
});

describe('GET /api/mail/unsubscribe', () => {
  it('returns 400 HTML without token', async () => {
    const res = await GET(makeReq('GET') as never);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('Lien invalide');
  });

  it('returns 400 HTML with invalid token', async () => {
    vi.mocked(verifyUnsubToken).mockReturnValue(null);
    const res = await GET(makeReq('GET', 'bad') as never);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Lien invalide');
  });

  // UX-PUB-004 — GET avec token valide = page de CONFIRMATION non destructive.
  // (Avant la vague 4, le GET exécutait la suppression immédiatement → un
  // préfetch de lien désinscrivait sans intention. Désormais le GET n'écrit
  // RIEN : il propose de confirmer via un POST.)
  it('UX-PUB-004 : GET token valide → page « Confirmer la désinscription », AUCUNE écriture DB', async () => {
    vi.mocked(verifyUnsubToken).mockReturnValue('bye@example.com');
    const drizzle = makeFakeDrizzle();
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const res = await GET(makeReq('GET', 'good') as never);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    // La page invite à confirmer et nomme l'adresse concernée.
    expect(html).toContain('Confirmer la désinscription');
    expect(html).toContain('bye@example.com');
    // UX-PUB-005 — un chemin de retour direct est offert.
    expect(html).toContain('Me réabonner');
    // Oracle anti-régression : le GET n'a déclenché AUCUNE mutation.
    expect(drizzle.calls.insert).toHaveLength(0);
    expect(drizzle.calls.update).toHaveLength(0);
    expect(drizzle.calls.delete).toHaveLength(0);
  });
});
