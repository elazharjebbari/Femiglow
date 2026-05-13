/**
 * Integration tests for POST /api/mail/webhook/stalwart.
 *
 * Covers : bearer auth, Zod payload parsing, dispatching to email_outbox
 * UPDATE based on event type, suppression INSERT on hard bounce.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

// vi.mock is hoisted to top of file — keep the secret inline to avoid TDZ.
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    env: { ...actual.env, FEMIGLOW_STALWART_WEBHOOK_SECRET: 'ssssssssssssssssssssssssssssssssssssssss' },
  };
});

const SECRET = 'ssssssssssssssssssssssssssssssssssssssss';
vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { POST } from '../route';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/mail/webhook/stalwart', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/mail/webhook/stalwart', () => {
  it('rejects without bearer (401)', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle() as never);
    const res = await POST(
      makeReq({ event: 'delivery.delivered', messageId: '<x>', ts: '2026-01-01T00:00:00Z' }) as never,
    );
    expect(res.status).toBe(401);
  });

  it('rejects with wrong bearer (401)', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle() as never);
    const res = await POST(
      makeReq(
        { event: 'delivery.delivered', messageId: '<x>', ts: '2026-01-01T00:00:00Z' },
        { 'x-fg-webhook-token': 'wrong' },
      ) as never,
    );
    expect(res.status).toBe(401);
  });

  it('rejects invalid JSON (400)', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle() as never);
    const req = new Request('http://test/api/mail/webhook/stalwart', {
      method: 'POST',
      headers: { 'x-fg-webhook-token': SECRET },
      body: 'not json',
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('returns 200 + ignored=true on unknown event (passthrough)', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle() as never);
    const res = await POST(
      makeReq(
        { event: 'random.thing', whatever: 'data' },
        { 'x-fg-webhook-token': SECRET },
      ) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignored).toBe('unhandled-event');
  });

  it('logs auth.failed without DB writes', async () => {
    const drizzle = makeFakeDrizzle();
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const res = await POST(
      makeReq(
        { event: 'auth.failed', user: 'foo@bar.c', ip: '1.2.3.4', ts: '2026-01-01T00:00:00Z' },
        { 'x-fg-webhook-token': SECRET },
      ) as never,
    );
    expect(res.status).toBe(200);
    expect(drizzle.calls.update).toHaveLength(0);
  });

  it('returns 200 + ignored=unknown-message-id when outbox row missing', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [] }) as never);
    const res = await POST(
      makeReq(
        {
          event: 'delivery.delivered',
          messageId: '<unknown>',
          rcpt: 'a@b.c',
          ts: '2026-01-01T00:00:00Z',
        },
        { 'x-fg-webhook-token': SECRET },
      ) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignored).toBe('unknown-message-id');
  });

  it('UPDATEs outbox.status=delivered on delivery.delivered', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{
        id: 'outbox-1',
        toEmail: 'a@b.c',
        smtpMessageId: '<msg-1>',
        status: 'sent',
      }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const res = await POST(
      makeReq(
        {
          event: 'delivery.delivered',
          messageId: '<msg-1>',
          rcpt: 'a@b.c',
          ts: '2026-05-13T19:00:00Z',
        },
        { 'x-fg-webhook-token': SECRET },
      ) as never,
    );
    expect(res.status).toBe(200);
    expect(drizzle.calls.update).toHaveLength(1);
    const set = drizzle.calls.update[0]!.set as Record<string, unknown>;
    expect(set.status).toBe('delivered');
    expect(drizzle.calls.insert).toHaveLength(1); // email_event row
  });

  it('inserts hard_bounce suppression on delivery.failed 5xx', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{
        id: 'outbox-2',
        toEmail: 'bad@example.com',
        smtpMessageId: '<msg-2>',
        status: 'sent',
      }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const res = await POST(
      makeReq(
        {
          event: 'delivery.failed',
          messageId: '<msg-2>',
          rcpt: 'bad@example.com',
          errorCode: 550,
          reason: 'mailbox not found',
          ts: '2026-05-13T19:00:00Z',
        },
        { 'x-fg-webhook-token': SECRET },
      ) as never,
    );
    expect(res.status).toBe(200);
    // 1 outbox UPDATE (set bounced_permanent) + 1 email_event INSERT + 1 suppression INSERT
    expect(drizzle.calls.update[0]!.set).toMatchObject({
      status: 'bounced_permanent',
      bounceType: 'hard',
    });
    // 2 inserts : event + suppression
    expect(drizzle.calls.insert.length).toBeGreaterThanOrEqual(2);
    const suppression = drizzle.calls.insert.find(
      (i) => (i.values as { reason?: string })?.reason === 'hard_bounce',
    );
    expect(suppression).toBeDefined();
  });

  it('inserts bounced_soft on delivery.failed 4xx (no suppression)', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{
        id: 'outbox-3',
        toEmail: 'a@b.c',
        smtpMessageId: '<msg-3>',
        status: 'sent',
      }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    await POST(
      makeReq(
        {
          event: 'delivery.failed',
          messageId: '<msg-3>',
          rcpt: 'a@b.c',
          errorCode: 421,
          reason: 'try again later',
          ts: '2026-05-13T19:00:00Z',
        },
        { 'x-fg-webhook-token': SECRET },
      ) as never,
    );
    expect(drizzle.calls.update[0]!.set).toMatchObject({
      status: 'bounced_soft',
      bounceType: 'soft',
    });
    // Only event INSERT, no suppression
    const hard = drizzle.calls.insert.find(
      (i) => (i.values as { reason?: string })?.reason === 'hard_bounce',
    );
    expect(hard).toBeUndefined();
  });
});
