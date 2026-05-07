import { describe, it, expect, beforeEach } from 'vitest';
import { decryptSecret, encryptSecret, generateWebhookSecret } from './encryption';

describe('encryption AES-256-GCM', () => {
  beforeEach(() => {
    process.env.WEBHOOK_SECRET_KEY = 'k'.repeat(32);
  });

  it('roundtrip encrypt/decrypt', () => {
    const plain = 'super-secret-value';
    const enc = encryptSecret(plain);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it('produit des ciphertexts différents pour le même plaintext (IV aléatoire)', () => {
    const plain = 'same';
    expect(encryptSecret(plain)).not.toBe(encryptSecret(plain));
  });

  it('échoue si le payload est corrompu (auth tag invalide)', () => {
    const enc = encryptSecret('hello');
    const tampered = enc.slice(0, -4) + 'AAAA';
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('generateWebhookSecret produit des secrets de longueur > 30', () => {
    const s = generateWebhookSecret();
    expect(s.length).toBeGreaterThan(30);
    expect(s).not.toBe(generateWebhookSecret());
  });
});
