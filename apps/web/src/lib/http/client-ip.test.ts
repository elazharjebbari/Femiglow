import { describe, it, expect } from 'vitest';
import { getClientIp, hashIp } from './client-ip';

function req(headers: Record<string, string>): { headers: Headers } {
  return { headers: new Headers(headers) };
}

describe('getClientIp', () => {
  it('prend le premier IP de x-forwarded-for', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('fallback sur x-real-ip', () => {
    expect(getClientIp(req({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
  });

  it('retourne 0.0.0.0 si rien', () => {
    expect(getClientIp(req({}))).toBe('0.0.0.0');
  });
});

describe('hashIp', () => {
  it('produit un hash 16 chars stable', () => {
    const a = hashIp('1.2.3.4');
    const b = hashIp('1.2.3.4');
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it('change avec l’IP', () => {
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('1.2.3.5'));
  });
});
