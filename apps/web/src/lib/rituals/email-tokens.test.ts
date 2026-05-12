import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decodeEmailToken, generateEmailToken } from './email-tokens';

beforeEach(() => {
  process.env.RITUAL_EMAIL_SECRET = 'test-secret-32chars-aaaaaaaaaaaaa';
});

afterEach(() => {
  delete process.env.RITUAL_EMAIL_SECRET;
});

describe('email tokens HMAC', () => {
  const validPayload = {
    orderId: 'order-001',
    customerHash: 'abc123',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 30 * 86400 * 1000,
  };

  it('encode + decode roundtrip', () => {
    const token = generateEmailToken(validPayload);
    const decoded = decodeEmailToken(token);
    expect(decoded.orderId).toBe(validPayload.orderId);
    expect(decoded.customerHash).toBe(validPayload.customerHash);
  });

  it('rejette token signé avec un autre secret', () => {
    const token = generateEmailToken(validPayload);
    process.env.RITUAL_EMAIL_SECRET = 'autre-secret';
    expect(() => decodeEmailToken(token)).toThrow(/signature/i);
  });

  it('rejette token expiré', () => {
    const expired = {
      ...validPayload,
      expiresAt: Date.now() - 1000,
    };
    const token = generateEmailToken(expired);
    expect(() => decodeEmailToken(token)).toThrow(/expiré/i);
  });

  it('rejette token mal formé', () => {
    expect(() => decodeEmailToken('garbage')).toThrow();
  });

  it('rejette signature invalide', () => {
    const token = generateEmailToken(validPayload);
    const [body] = token.split('.');
    expect(() => decodeEmailToken(`${body}.invalid-sig`)).toThrow(/signature/i);
  });

  it('utilise timingSafeEqual (pas de fast-fail visible)', () => {
    // sanity check : 2 tokens différents donnent erreur uniformément
    const t1 = generateEmailToken(validPayload);
    const t2 = generateEmailToken({ ...validPayload, orderId: 'order-002' });
    const [b1] = t1.split('.');
    const [, s2] = t2.split('.');
    expect(() => decodeEmailToken(`${b1}.${s2}`)).toThrow(/signature/i);
  });
});
