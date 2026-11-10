import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { hashIdentity, normalizePhone as normalizeServer } from './hashing';
import { hashIdentityBrowser, normalizePhone as normalizeBrowser } from './hashing-browser';
import { normalizePhoneDigits } from './phone-normalize';

const E164 = '212612345678';

describe('normalizePhoneDigits — toutes les saisies du même numéro donnent 212…', () => {
  it.each([
    ['612345678', '9 chiffres, forme envoyée par le formulaire /kit'],
    ['0612345678', 'national avec 0'],
    ['06 12 34 56 78', 'national espacé'],
    ['06-12-34-56-78', 'national avec tirets'],
    ['+212612345678', 'E.164'],
    ['+212 6 12 34 56 78', 'E.164 espacé'],
    ['00212612345678', 'préfixe international 00'],
    ['212612345678', 'E.164 sans +'],
    ['٠٦١٢٣٤٥٦٧٨', 'chiffres arabes orientaux'],
    ['۰۶۱۲۳۴۵۶۷۸', 'chiffres persans'],
  ])('%s (%s)', (raw) => {
    expect(normalizePhoneDigits(raw)).toBe(E164);
  });

  it('mobile 7 et fixe 5 à 9 chiffres', () => {
    expect(normalizePhoneDigits('712345678')).toBe('212712345678');
    expect(normalizePhoneDigits('522123456')).toBe('212522123456');
  });

  it("ne touche pas un numéro qui n'est pas marocain à 9 chiffres", () => {
    expect(normalizePhoneDigits('812345678')).toBe('812345678');
    expect(normalizePhoneDigits('33612345678')).toBe('33612345678');
    expect(normalizePhoneDigits('')).toBe('');
  });
});

describe('hachage — serveur et navigateur identiques', () => {
  const expected = createHash('sha256').update(E164).digest('hex');
  const expectedPlus = createHash('sha256').update(`+${E164}`).digest('hex');

  it('les deux normaliseurs donnent la même chaîne', () => {
    for (const raw of ['612345678', '0612345678', '+212612345678']) {
      expect(normalizeServer(raw)).toBe(normalizeBrowser(raw));
    }
  });

  it('serveur : hash du numéro 9 chiffres = hash de 212612345678', () => {
    expect(hashIdentity({ phone: '612345678' }).ph).toBe(expected);
  });

  it('navigateur : hash du numéro 9 chiffres = hash de 212612345678 (Meta et Google)', async () => {
    const out = (await hashIdentityBrowser({ phone: '612345678' })) as Record<string, string>;
    const values = Object.values(out);
    expect(values).toContain(expected);
    // Google Enhanced Conversions attend le +E.164 haché.
    expect(values).toContain(expectedPlus);
  });
});
