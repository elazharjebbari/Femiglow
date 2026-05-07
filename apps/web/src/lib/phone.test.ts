/**
 * CHA-202 — Tests pour `parsePhone` / `tryParsePhone` / `formatPhoneDisplay`.
 *
 * Couverture :
 *   - MA : mobile (06/07), fixe (05), formats E.164/00/0/local sans 0,
 *     formatages humains (espaces, tirets, parenthèses), trop court/long,
 *     caractères invalides.
 *   - FR : mobile, fixe, hint vs explicite.
 *   - BE / CH / DZ / TN : un cas chacun pour valider la table.
 *   - Edge cases : empty, only `+`, double `00`, hint inconnu.
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §6.1
 */
import { describe, expect, it } from 'vitest';

import {
  parsePhone,
  tryParsePhone,
  stripFormatting,
  formatPhoneDisplay,
  PhoneParseError,
} from './phone';

describe('stripFormatting', () => {
  it('preserves leading +', () => {
    expect(stripFormatting('+212 6 12 34 56 78')).toBe('+212612345678');
  });
  it('strips spaces, dashes, parens, dots', () => {
    expect(stripFormatting('06.12-34 (56) 78')).toBe('0612345678');
  });
  it('returns empty for empty input', () => {
    expect(stripFormatting('')).toBe('');
    expect(stripFormatting('   ')).toBe('');
  });
});

describe('parsePhone — Maroc (hint default)', () => {
  it.each([
    ['0612345678', '+212612345678'],
    ['06 12 34 56 78', '+212612345678'],
    ['06-12-34-56-78', '+212612345678'],
    ['+212612345678', '+212612345678'],
    ['+212 612 345 678', '+212612345678'],
    ['00212612345678', '+212612345678'],
    ['212612345678', '+212612345678'],
    ['612345678', '+212612345678'], // local sans 0
  ])('normalise "%s" → %s', (input, expected) => {
    expect(parsePhone(input).e164).toBe(expected);
  });

  it('détecte un mobile 06 comme mobile', () => {
    const p = parsePhone('0612345678');
    expect(p.type).toBe('mobile');
    expect(p.country).toBe('MA');
  });

  it('détecte un mobile 07 comme mobile', () => {
    const p = parsePhone('0712345678');
    expect(p.type).toBe('mobile');
  });

  it('détecte un fixe 05 comme fixe', () => {
    const p = parsePhone('0537712345');
    expect(p.type).toBe('fixed');
  });

  it("rejette un préfixe 1 invalide pour le Maroc", () => {
    expect(() => parsePhone('0112345678')).toThrow(PhoneParseError);
  });

  it('rejette un numéro trop court (< 6 chiffres)', () => {
    expect(() => parsePhone('06123')).toThrowError(/too-short/);
  });

  it('rejette un numéro trop long (> 15 chiffres)', () => {
    expect(() => parsePhone('06123456789012345')).toThrowError(/too-long/);
  });

  it("rejette une longueur incorrecte pour le pays", () => {
    // Après strip formatting → '0612345' (7 chiffres) — la règle MA exige 9.
    expect(() => parsePhone('06abc12345')).toThrowError(/wrong-length/);
  });

  it('rejette une chaîne vide', () => {
    expect(() => parsePhone('')).toThrowError(/empty/);
    expect(() => parsePhone('   ')).toThrowError(/empty/);
  });
});

describe('parsePhone — France', () => {
  it('parse un mobile FR avec hint', () => {
    const p = parsePhone('0612345678', 'FR');
    expect(p.e164).toBe('+33612345678');
    expect(p.country).toBe('FR');
    expect(p.type).toBe('mobile');
  });

  it('parse un fixe FR Paris (01)', () => {
    const p = parsePhone('0142345678', 'FR');
    expect(p.e164).toBe('+33142345678');
    expect(p.type).toBe('fixed');
  });

  it('respecte un + explicite même avec hint MA', () => {
    const p = parsePhone('+33612345678', 'MA');
    expect(p.country).toBe('FR');
  });
});

describe('parsePhone — autres pays', () => {
  it('parse un numéro BE (8 chiffres mobile)', () => {
    const p = parsePhone('+32470123456');
    expect(p.country).toBe('BE');
    expect(p.type).toBe('mobile');
  });

  it('parse un numéro CH', () => {
    const p = parsePhone('+41791234567');
    expect(p.country).toBe('CH');
    expect(p.type).toBe('mobile');
  });

  it('parse un numéro DZ', () => {
    const p = parsePhone('+213551234567');
    expect(p.country).toBe('DZ');
    expect(p.type).toBe('mobile');
  });

  it('parse un numéro TN', () => {
    const p = parsePhone('+21620123456');
    expect(p.country).toBe('TN');
    expect(p.type).toBe('mobile');
  });
});

describe('parsePhone — edge cases', () => {
  it('rejette un indicatif pays inconnu', () => {
    expect(() => parsePhone('+999123456789')).toThrowError(/unknown-country/);
  });

  it('rejette un numéro contenant uniquement +', () => {
    expect(() => parsePhone('+')).toThrowError(/invalid-chars/);
  });

  it("rejette un préfixe national invalide pour MA (longueur correcte)", () => {
    // '0312345678' → trunk '0' strippé → '312345678' (9 chiffres, longueur OK)
    // mais '3' n'est ni mobile (6/7) ni fixe (5) MA → invalid-national.
    expect(() => parsePhone('0312345678')).toThrowError(/invalid-national/);
  });
});

describe('tryParsePhone', () => {
  it('renvoie le NormalizedPhone si valide', () => {
    expect(tryParsePhone('0612345678')).toMatchObject({
      e164: '+212612345678',
      country: 'MA',
    });
  });

  it('renvoie null si invalide', () => {
    expect(tryParsePhone('abc')).toBeNull();
    expect(tryParsePhone('')).toBeNull();
    expect(tryParsePhone('+999123456789')).toBeNull();
  });
});

describe('formatPhoneDisplay', () => {
  it('formate un numéro MA en groupes lisibles', () => {
    const p = parsePhone('0612345678');
    expect(formatPhoneDisplay(p)).toBe('+212 6 12 34 56 78');
  });

  it('formate un numéro FR en groupes lisibles', () => {
    const p = parsePhone('+33612345678');
    expect(formatPhoneDisplay(p)).toBe('+33 6 12 34 56 78');
  });

  it('formate un numéro BE', () => {
    const p = parsePhone('+32470123456');
    expect(formatPhoneDisplay(p)).toBe('+32 470 12 34 56');
  });
});
