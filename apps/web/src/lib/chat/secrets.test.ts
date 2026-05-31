import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_KEY = 'a'.repeat(64);

describe('chat secrets', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/lib/env', () => ({ env: { CHAT_PROVIDER_KEY: TEST_KEY } }));
  });

  it('round-trips a plaintext value', async () => {
    const { encryptSecret, decryptSecret } = await import('./secrets');
    const encoded = encryptSecret('sk-OpenAI-test-1234567890');
    expect(encoded.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(encoded.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decryptSecret(encoded)).toBe('sk-OpenAI-test-1234567890');
  });

  it('produces a different ciphertext for the same plaintext (random IV)', async () => {
    const { encryptSecret } = await import('./secrets');
    const a = encryptSecret('hello world');
    const b = encryptSecret('hello world');
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it('rejects ciphertext that has been tampered', async () => {
    const { encryptSecret, decryptSecret } = await import('./secrets');
    const encoded = encryptSecret('payload');
    // `Buffer.prototype.map()` est hérité d'`Uint8Array` et retourne un
    // `Uint8Array`, pas un `Buffer`. Or `Uint8Array.toString()` n'accepte
    // pas d'argument d'encodage. On re-wrappe explicitement le résultat
    // dans un `Buffer` avant `.toString('base64')` pour récupérer le
    // bon overload.
    const tamperedBytes = Buffer.from(encoded.ciphertext, 'base64').map(
      (b, i) => (i === 0 ? b ^ 0xff : b),
    );
    const tampered = {
      ...encoded,
      ciphertext: Buffer.from(tamperedBytes).toString('base64'),
    };
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('throws when CHAT_PROVIDER_KEY is missing', async () => {
    vi.resetModules();
    vi.doMock('@/lib/env', () => ({ env: { CHAT_PROVIDER_KEY: undefined } }));
    const { encryptSecret, ChatSecretsConfigError } = await import('./secrets');
    expect(() => encryptSecret('foo')).toThrow(ChatSecretsConfigError);
  });

  it('masks secrets safely', async () => {
    const { maskSecret } = await import('./secrets');
    expect(maskSecret(null)).toBe('');
    expect(maskSecret('abc')).toBe('••••');
    expect(maskSecret('sk-1234567890abcdef')).toBe('sk-…def');
  });
});
