/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { hashIdentityBrowser, normalizeEmail, normalizePhone } from './hashing-browser';

// SHA-256 reference vectors (clear → expected hex). Verified via
// `echo -n "foo@bar.com" | sha256sum`.
const HASH_OF_FOO_AT_BAR_COM =
  '0c7e6a405862e402eb76a70f8a26fc732d07c32931e9fae9ab1582911d2e8a3b';

describe('hashing-browser — normalisation', () => {
  it('normalizeEmail = trim + lowercase', () => {
    expect(normalizeEmail('  Foo@BAR.COM  ')).toBe('foo@bar.com');
  });

  it('normalizePhone — 0612345678 → 212612345678 (E.164 sans +)', () => {
    expect(normalizePhone('0612345678')).toBe('212612345678');
    expect(normalizePhone('06 12 34 56 78')).toBe('212612345678');
    expect(normalizePhone('+212 6 12 34 56 78')).toBe('212612345678');
    expect(normalizePhone('00212612345678')).toBe('212612345678');
  });
});

describe('hashing-browser — hash SHA-256', () => {
  it('hashIdentityBrowser produit les champs au format Google Ads', async () => {
    const out = await hashIdentityBrowser({
      email: 'foo@bar.com',
      phone: '0612345678',
      firstName: 'Yasmine',
      lastName: 'Idrissi',
      city: 'Casablanca',
      country: 'Maroc',
    });
    expect(out.sha256_email_address).toBe(HASH_OF_FOO_AT_BAR_COM);
    expect(out.sha256_phone_number).toMatch(/^[a-f0-9]{64}$/);
    expect(out.address?.sha256_first_name).toMatch(/^[a-f0-9]{64}$/);
    expect(out.address?.sha256_last_name).toMatch(/^[a-f0-9]{64}$/);
    expect(out.address?.city).toBe('casablanca');
    expect(out.address?.country).toBe('maroc');
  });

  it('sha256_phone_e164 hache le numéro avec `+`, sans toucher au hash Meta', async () => {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('+212612345678'),
    );
    const expected = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const out = await hashIdentityBrowser({ phone: '06 12 34 56 78' });
    expect(out.sha256_phone_e164).toBe(expected);
    expect(out.sha256_phone_number).not.toBe(expected);
  });

  it('omits empty fields', async () => {
    const out = await hashIdentityBrowser({ email: 'foo@bar.com' });
    expect(out.sha256_email_address).toBeDefined();
    expect(out.sha256_phone_number).toBeUndefined();
    expect(out.address).toBeUndefined();
  });

  it('même input → même hash (déterministe)', async () => {
    const a = await hashIdentityBrowser({ email: 'foo@bar.com' });
    const b = await hashIdentityBrowser({ email: 'FOO@bar.com' });
    expect(a.sha256_email_address).toBe(b.sha256_email_address);
  });
});
