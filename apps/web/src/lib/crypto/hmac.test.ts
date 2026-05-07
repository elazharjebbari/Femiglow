import { describe, it, expect } from 'vitest';
import { signHmac, verifyHmac } from './hmac';

describe('HMAC SHA-256', () => {
  const secret = 'a'.repeat(32);

  it('produit une signature déterministe', () => {
    const a = signHmac(secret, 'payload');
    const b = signHmac(secret, 'payload');
    expect(a).toBe(b);
  });

  it('change si le payload change', () => {
    expect(signHmac(secret, 'a')).not.toBe(signHmac(secret, 'b'));
  });

  it('change si le secret change', () => {
    expect(signHmac('s1' + 'x'.repeat(30), 'p')).not.toBe(signHmac('s2' + 'x'.repeat(30), 'p'));
  });

  it('verify retourne true sur match', () => {
    const sig = signHmac(secret, 'hello');
    expect(verifyHmac(secret, 'hello', sig)).toBe(true);
  });

  it('verify retourne false sur signature falsifiée', () => {
    const sig = signHmac(secret, 'hello');
    expect(verifyHmac(secret, 'hello', sig + 'x')).toBe(false);
  });

  it('verify retourne false si payload différent', () => {
    const sig = signHmac(secret, 'hello');
    expect(verifyHmac(secret, 'world', sig)).toBe(false);
  });
});
