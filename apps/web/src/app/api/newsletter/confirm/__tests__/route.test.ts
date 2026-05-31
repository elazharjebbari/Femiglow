/**
 * Integration tests for GET /api/newsletter/confirm?t=<token>.
 *
 * Verifies the double-opt-in confirmation page :
 *   - missing or invalid token returns 400 HTML
 *   - valid token + no existing subscriber → INSERT row enabled
 *   - valid token + existing subscriber → UPDATE row to enabled
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

import { GET } from '../route';
import { verifyUnsubToken } from '@/lib/mail/unsub-token';
import { db as getDb } from '@/lib/db/client';

function makeReq(token?: string): Request {
  const url = token === undefined
    ? 'http://test/api/newsletter/confirm'
    : `http://test/api/newsletter/confirm?t=${encodeURIComponent(token)}`;
  return new Request(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/newsletter/confirm', () => {
  it('returns 400 HTML when token is missing', async () => {
    const res = await GET(makeReq() as never);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('Lien invalide');
  });

  it('returns 400 HTML when token is invalid', async () => {
    vi.mocked(verifyUnsubToken).mockReturnValue(null);
    const res = await GET(makeReq('bad-token') as never);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Lien invalide');
  });

  it('returns 400 if db is not configured', async () => {
    vi.mocked(verifyUnsubToken).mockReturnValue('a@b.c');
    vi.mocked(getDb).mockReturnValue(undefined as never);
    const res = await GET(makeReq('valid-token') as never);
    expect(res.status).toBe(400);
  });

  it('INSERTs new subscriber when none exists', async () => {
    vi.mocked(verifyUnsubToken).mockReturnValue('new@example.com');
    const drizzle = makeFakeDrizzle({ selectResult: [] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const res = await GET(makeReq('valid-token') as never);
    expect(res.status).toBe(200);
    expect(drizzle.calls.insert).toHaveLength(1);
    expect(drizzle.calls.update).toHaveLength(0);
    const values = drizzle.calls.insert[0]!.values as Record<string, unknown>;
    expect(values).toMatchObject({
      email: 'new@example.com',
      status: 'enabled',
      consentSource: 'newsletter-form',
    });
    expect(values.doubleOptinConfirmedAt).toBeInstanceOf(Date);
  });

  it('UPDATEs existing subscriber when row found', async () => {
    vi.mocked(verifyUnsubToken).mockReturnValue('existing@example.com');
    const drizzle = makeFakeDrizzle({ selectResult: [{ email: 'existing@example.com' }] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const res = await GET(makeReq('valid-token') as never);
    expect(res.status).toBe(200);
    expect(drizzle.calls.update).toHaveLength(1);
    expect(drizzle.calls.insert).toHaveLength(0);
    const set = drizzle.calls.update[0]!.set as Record<string, unknown>;
    expect(set).toMatchObject({ status: 'enabled' });
    expect(set.doubleOptinConfirmedAt).toBeInstanceOf(Date);
  });

  it('returns success HTML page on happy path', async () => {
    vi.mocked(verifyUnsubToken).mockReturnValue('ok@example.com');
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [] }) as never);
    const res = await GET(makeReq('valid-token') as never);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('Inscription confirmée');
  });
});
