import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    env: { ...actual.env, LISTMONK_WEBHOOK_SECRET: 'llllllllllllllllllllllllllllllllllllllll' },
  };
});

const SECRET = 'llllllllllllllllllllllllllllllllllllllll';
vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { POST } from '../route';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockReturnValue(makeFakeDrizzle() as never);
});

function sign(body: string): string {
  return 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
}

function makeReq(body: unknown, sigOverride?: string): Request {
  const raw = JSON.stringify(body);
  return new Request('http://test/api/mail/webhook/listmonk', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-listmonk-signature': sigOverride ?? sign(raw),
    },
    body: raw,
  });
}

describe('POST /api/mail/webhook/listmonk', () => {
  it('rejects without signature (401)', async () => {
    const req = new Request('http://test/api/mail/webhook/listmonk', {
      method: 'POST',
      body: JSON.stringify({ event: 'subscriber.created', data: {} }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it('rejects with wrong signature (401)', async () => {
    const res = await POST(makeReq({ event: 'subscriber.created', data: {} }, 'sha256=bad') as never);
    expect(res.status).toBe(401);
  });

  it('accepts valid signature + known event', async () => {
    const res = await POST(makeReq({ event: 'subscriber.created', data: { email: 'a@b.c' } }) as never);
    expect(res.status).toBe(200);
  });

  it('accepts hex-only signature (no sha256= prefix)', async () => {
    const raw = JSON.stringify({ event: 'subscriber.created', data: { email: 'x@y.z' } });
    const hex = createHmac('sha256', SECRET).update(raw).digest('hex');
    const req = new Request('http://test/api/mail/webhook/listmonk', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-listmonk-signature': hex },
      body: raw,
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
  });

  it('returns 200 + ignored on unknown event', async () => {
    const res = await POST(makeReq({ event: 'something.else', data: {} }) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignored).toBe('unknown-event');
  });

  it('returns 400 on malformed JSON', async () => {
    const req = new Request('http://test/api/mail/webhook/listmonk', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-listmonk-signature': sign('not json'),
      },
      body: 'not json',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  // Note : the 'secret not configured' branch is tested at the unit level
  // via the env mock — it's hard to verify here without re-importing the
  // module, which Vitest discourages.

  it('returns 200 even if dispatcher throws (no retry-storm)', async () => {
    // Force dispatcher path to fail by making transaction reject
    const drizzle = makeFakeDrizzle();
    drizzle.transaction.mockRejectedValue(new Error('boom'));
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const res = await POST(
      makeReq({ event: 'subscriber.unsubscribed', data: { email: 'a@b.c' } }) as never,
    );
    expect(res.status).toBe(200);
  });
});
