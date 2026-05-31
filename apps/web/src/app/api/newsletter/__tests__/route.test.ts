/**
 * Integration tests for POST /api/newsletter.
 *
 * Validates the double-opt-in flow :
 *   - rate-limit short-circuit
 *   - JSON / validation errors (consent must be true)
 *   - happy path : sendTransactional called with template newsletter-confirm
 *     and a confirmUrl that contains a generated token
 *   - token generation failure (no MAIL_UNSUB_TOKEN_SECRET) returns 200
 *     without sending (graceful degrade)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/mail/rate-limit', () => ({
  enforceMailRateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/mail/send', () => ({
  sendTransactional: vi.fn().mockResolvedValue({ status: 'queued' }),
}));
vi.mock('@/lib/mail/unsub-token', () => ({
  generateUnsubToken: vi.fn().mockReturnValue('FAKE.TOKEN'),
}));

import { POST } from '../route';
import { sendTransactional } from '@/lib/mail/send';
import { generateUnsubToken } from '@/lib/mail/unsub-token';
import { enforceMailRateLimit } from '@/lib/mail/rate-limit';

function makeReq(body: unknown): Request {
  return new Request('http://test/api/newsletter', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '5.6.7.8' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enforceMailRateLimit).mockResolvedValue(null);
  vi.mocked(generateUnsubToken).mockReturnValue('FAKE.TOKEN');
});

describe('POST /api/newsletter', () => {
  it('returns 429 when rate-limit triggers', async () => {
    vi.mocked(enforceMailRateLimit).mockResolvedValueOnce(
      new Response('Too many requests', { status: 429 }) as never,
    );
    const res = await POST(makeReq({ email: 'x@y.z', consent: true }));
    expect(res.status).toBe(429);
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await POST(makeReq('not json'));
    expect(res.status).toBe(400);
  });

  it('returns 422 when consent is missing', async () => {
    const res = await POST(makeReq({ email: 'a@b.c' }));
    expect(res.status).toBe(422);
    expect(sendTransactional).not.toHaveBeenCalled();
  });

  it('returns 422 when consent is false', async () => {
    const res = await POST(makeReq({ email: 'a@b.c', consent: false }));
    expect(res.status).toBe(422);
  });

  it('returns 422 on invalid email', async () => {
    const res = await POST(makeReq({ email: 'no-arobase', consent: true }));
    expect(res.status).toBe(422);
  });

  it('happy path returns 200 + triggers confirm email with token URL', async () => {
    const res = await POST(makeReq({ email: 'fan@example.com', consent: true, source: 'footer' }));
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));
    expect(sendTransactional).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(sendTransactional).mock.calls[0]![0]!;
    expect(arg).toMatchObject({
      template: 'newsletter-confirm',
      to: { email: 'fan@example.com' },
      source: 'api.newsletter.footer',
      idempotencyKey: 'newsletter-confirm:fan@example.com',
    });
    expect(arg.payload).toMatchObject({
      confirmUrl: expect.stringMatching(/\/api\/newsletter\/confirm\?t=FAKE\.TOKEN$/),
    });
  });

  it('returns 200 without sending if token generation fails (no secret configured)', async () => {
    vi.mocked(generateUnsubToken).mockImplementationOnce(() => {
      throw new Error('MAIL_UNSUB_TOKEN_SECRET not configured');
    });
    const res = await POST(makeReq({ email: 'fan@example.com', consent: true }));
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));
    expect(sendTransactional).not.toHaveBeenCalled();
  });

  it('defaults source to "unknown" when omitted', async () => {
    await POST(makeReq({ email: 'fan@example.com', consent: true }));
    await new Promise((r) => setImmediate(r));
    expect(vi.mocked(sendTransactional).mock.calls[0]![0]!.source).toBe('api.newsletter.unknown');
  });
});
