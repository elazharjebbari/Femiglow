import { describe, expect, it } from 'vitest';
import { hashIdentity, normalizeEmail, normalizePhone, sha256Hex } from './hashing';

describe('hashing', () => {
  it('normalizeEmail : trim + lowercase', () => {
    expect(normalizeEmail('  John.Doe@Example.COM  ')).toBe('john.doe@example.com');
  });

  it('normalizePhone : ne garde que les chiffres', () => {
    expect(normalizePhone('+212 (5) 22-12-34')).toBe('2125221234');
  });

  it('hashIdentity : email standard donne le hash SHA-256 attendu', () => {
    const expected = sha256Hex('john@example.com');
    const out = hashIdentity({ email: 'JOHN@example.com' });
    expect(out.em).toBe(expected);
  });

  it('hashIdentity : champs absents → undefined', () => {
    const out = hashIdentity({});
    expect(out.em).toBeUndefined();
    expect(out.ph).toBeUndefined();
  });

  it('hashIdentity : tous les champs hachés', () => {
    const out = hashIdentity({
      email: 'a@b.fr',
      phone: '+33 6 12 34 56 78',
      firstName: 'Léa',
      lastName: 'Martin',
      city: 'Casablanca',
      country: 'MA',
    });
    expect(out.em).toMatch(/^[0-9a-f]{64}$/);
    expect(out.ph).toMatch(/^[0-9a-f]{64}$/);
    expect(out.fn).toMatch(/^[0-9a-f]{64}$/);
    expect(out.ln).toMatch(/^[0-9a-f]{64}$/);
    expect(out.ct).toMatch(/^[0-9a-f]{64}$/);
    expect(out.country).toMatch(/^[0-9a-f]{64}$/);
  });
});
