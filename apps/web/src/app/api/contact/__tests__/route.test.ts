/**
 * Integration tests for POST /api/contact.
 *
 * The route validates the contact form, fires the outbound webhook AND
 * the transactional accusé-de-contact (both fire-and-forget). We verify :
 *   - JSON parse / validation errors are surfaced (400 / 422)
 *   - honeypot field (`website`) short-circuits to 200 with no side effects
 *   - happy path returns 200 and triggers sendTransactional with the
 *     contact-acknowledgement template + correct idempotencyKey
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/mail/rate-limit', () => ({
  enforceMailRateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/mail/send', () => ({
  sendTransactional: vi.fn().mockResolvedValue({ status: 'queued' }),
}));
vi.mock('@/lib/webhooks/outbound/sources/from-contact', () => ({
  dispatchContactWebhook: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '../route';
import { sendTransactional } from '@/lib/mail/send';
import { dispatchContactWebhook } from '@/lib/webhooks/outbound/sources/from-contact';
import { enforceMailRateLimit } from '@/lib/mail/rate-limit';

function makeReq(body: unknown): Request {
  return new Request('http://test/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function validBody(over: Partial<Record<string, unknown>> = {}) {
  return {
    type: 'question',
    name: 'Soukaina Lahlou',
    email: 'soukaina@example.com',
    message: 'Bonjour, j\'aimerais des informations sur la marque FemiGlow.',
    gdprConsent: true,
    newsletterOptIn: false,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enforceMailRateLimit).mockResolvedValue(null);
});

describe('POST /api/contact', () => {
  it('returns 429 when rate limit triggers', async () => {
    vi.mocked(enforceMailRateLimit).mockResolvedValueOnce(
      new Response('Too many requests', { status: 429 }) as never,
    );
    const res = await POST(makeReq(validBody()));
    expect(res.status).toBe(429);
    expect(sendTransactional).not.toHaveBeenCalled();
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await POST(makeReq('not json'));
    expect(res.status).toBe(400);
    expect(sendTransactional).not.toHaveBeenCalled();
  });

  it('returns 422 on validation failure (missing fields)', async () => {
    const res = await POST(makeReq({ email: 'no@name.test' }));
    expect(res.status).toBe(422);
    expect(sendTransactional).not.toHaveBeenCalled();
  });

  it('returns 422 on invalid email', async () => {
    const res = await POST(makeReq(validBody({ email: 'not-an-email' })));
    expect(res.status).toBe(422);
  });

  it('honeypot (website filled) short-circuits to 200 with no side effects', async () => {
    const res = await POST(makeReq(validBody({ website: 'http://spam.tld' })));
    expect(res.status).toBe(200);
    expect(sendTransactional).not.toHaveBeenCalled();
    expect(dispatchContactWebhook).not.toHaveBeenCalled();
  });

  it('happy path returns 200 + triggers transactional + outbound webhook', async () => {
    const res = await POST(makeReq(validBody()));
    expect(res.status).toBe(200);
    // sendTransactional is fire-and-forget → wait a tick
    await new Promise((r) => setImmediate(r));
    expect(sendTransactional).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(sendTransactional).mock.calls[0]![0]!;
    expect(callArg).toMatchObject({
      template: 'contact-acknowledgement',
      to: { email: 'soukaina@example.com', name: 'Soukaina Lahlou' },
      source: 'api.contact',
    });
    expect(callArg.idempotencyKey).toMatch(/^contact-ack:soukaina@example\.com:\d{4}-\d{2}-\d{2}$/);
    expect(callArg.payload).toMatchObject({
      firstName: 'Soukaina',
      messageExcerpt: expect.stringContaining('informations sur la marque'),
    });
    expect(dispatchContactWebhook).toHaveBeenCalledTimes(1);
  });

  it('does not throw if sendTransactional rejects (logged, swallowed)', async () => {
    vi.mocked(sendTransactional).mockRejectedValueOnce(new Error('SMTP down'));
    const res = await POST(makeReq(validBody({ email: 'fail@example.com' })));
    expect(res.status).toBe(200);
    // Let the unhandled rejection settle
    await new Promise((r) => setImmediate(r));
  });

  it('idempotencyKey lowercases the email for stability', async () => {
    await POST(makeReq(validBody({ email: 'Mixed.Case@Example.COM' })));
    await new Promise((r) => setImmediate(r));
    const callArg = vi.mocked(sendTransactional).mock.calls[0]![0]!;
    expect(callArg.idempotencyKey).toMatch(/^contact-ack:mixed\.case@example\.com:/);
  });
});
