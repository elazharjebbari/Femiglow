/**
 * Tests verifyStripeSignature — HMAC SHA256 + tolérance + signature multiple.
 */
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  parseStripeSignature,
  verifyStripeSignature,
} from './stripe-webhook';

const SECRET = 'whsec_test_secret_123456';

function sign(payload: string, timestamp: number, secret = SECRET): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
}

describe('parseStripeSignature', () => {
  it('parses standard t= and v1= header', () => {
    const parsed = parseStripeSignature('t=1234567890,v1=abc,v1=def');
    expect(parsed).toEqual({ timestamp: 1234567890, v1Signatures: ['abc', 'def'] });
  });

  it('returns null on malformed header', () => {
    expect(parseStripeSignature('garbage')).toBeNull();
    expect(parseStripeSignature('t=abc,v1=xyz')).toBeNull();
  });
});

describe('verifyStripeSignature', () => {
  it('accepts a valid signature within tolerance', () => {
    const now = new Date('2026-05-06T12:00:00Z');
    const ts = Math.floor(now.getTime() / 1000) - 30;
    const payload = '{"id":"evt_test","type":"payment_intent.succeeded"}';
    const sig = sign(payload, ts);
    expect(() =>
      verifyStripeSignature(payload, `t=${ts},v1=${sig}`, SECRET, 300, now),
    ).not.toThrow();
  });

  it('rejects when timestamp is outside tolerance', () => {
    const now = new Date('2026-05-06T12:00:00Z');
    const ts = Math.floor(now.getTime() / 1000) - 10 * 60; // 10 min old
    const payload = '{"id":"evt_test"}';
    const sig = sign(payload, ts);
    expect(() =>
      verifyStripeSignature(payload, `t=${ts},v1=${sig}`, SECRET, 300, now),
    ).toThrow(/tolerance/);
  });

  it('rejects when signature mismatches', () => {
    const now = new Date('2026-05-06T12:00:00Z');
    const ts = Math.floor(now.getTime() / 1000);
    const payload = '{"id":"evt_test"}';
    const sig = sign(payload, ts, 'WRONG_SECRET');
    expect(() =>
      verifyStripeSignature(payload, `t=${ts},v1=${sig}`, SECRET, 300, now),
    ).toThrow(/mismatch/);
  });

  it('accepts when at least one of multiple v1 signatures matches', () => {
    const now = new Date('2026-05-06T12:00:00Z');
    const ts = Math.floor(now.getTime() / 1000);
    const payload = '{"id":"evt_test"}';
    const goodSig = sign(payload, ts);
    const badSig = sign(payload, ts, 'WRONG');
    expect(() =>
      verifyStripeSignature(
        payload,
        `t=${ts},v1=${badSig},v1=${goodSig}`,
        SECRET,
        300,
        now,
      ),
    ).not.toThrow();
  });

  it('rejects malformed signature header', () => {
    const now = new Date('2026-05-06T12:00:00Z');
    expect(() =>
      verifyStripeSignature('payload', 'garbage', SECRET, 300, now),
    ).toThrow(/malformed/);
  });
});
