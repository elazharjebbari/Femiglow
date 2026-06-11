/**
 * Tests du masque téléphone FR — helper pur.
 */
import { describe, it, expect } from 'vitest';

import { formatPhoneFR, parsePhoneFR, toLocalMoroccanDigits } from './phone-mask';

describe('formatPhoneFR', () => {
  it('retourne vide pour string vide', () => {
    expect(formatPhoneFR('')).toBe('');
  });

  it('retourne 1 chiffre tel quel', () => {
    expect(formatPhoneFR('0')).toBe('0');
  });

  it('groupe par 2 dès 3 chiffres', () => {
    expect(formatPhoneFR('06')).toBe('06');
    expect(formatPhoneFR('061')).toBe('06 1');
  });

  it('formate 10 chiffres en 5 paires', () => {
    expect(formatPhoneFR('0612345678')).toBe('06 12 34 56 78');
  });

  it('tronque à 10 digits (input 11)', () => {
    expect(formatPhoneFR('06123456789')).toBe('06 12 34 56 78');
  });

  it('strip caractères non-numériques', () => {
    expect(formatPhoneFR('06-12.34/56 78')).toBe('06 12 34 56 78');
  });

  it('masque brut : +212 NON normalisé est tronqué (rôle de toLocalMoroccanDigits en amont)', () => {
    // `formatPhoneFR` reste un masque « bête » : il prend les 10 premiers digits.
    // La normalisation international→local est faite EN AMONT par
    // `toLocalMoroccanDigits` (cf. PhoneMaskInput). Ce test fige ce contrat.
    expect(formatPhoneFR('+212612345678')).toBe('21 26 12 34 56');
    expect(formatPhoneFR(toLocalMoroccanDigits('+212612345678'))).toBe('06 12 34 56 78');
  });

  it('idempotence : format(format(x)) === format(x)', () => {
    const v = '0612345678';
    expect(formatPhoneFR(formatPhoneFR(v))).toBe(formatPhoneFR(v));
  });
});

describe('parsePhoneFR', () => {
  it('retourne uniquement les chiffres', () => {
    expect(parsePhoneFR('06 12 34 56 78')).toBe('0612345678');
  });

  it('strip espaces et tirets', () => {
    expect(parsePhoneFR('06-12 34.56/78')).toBe('0612345678');
  });

  it('retourne vide si pas de digit', () => {
    expect(parsePhoneFR('abc')).toBe('');
  });
});

describe('toLocalMoroccanDigits', () => {
  it('international +212 → local 0XXXXXXXXX', () => {
    expect(toLocalMoroccanDigits('+212612345678')).toBe('0612345678');
    expect(toLocalMoroccanDigits('+212 6 12 34 56 78')).toBe('0612345678');
  });

  it('international 00212 → local 0XXXXXXXXX', () => {
    expect(toLocalMoroccanDigits('00212612345678')).toBe('0612345678');
    expect(toLocalMoroccanDigits('00212 612 345 678')).toBe('0612345678');
  });

  it('local 0XXXXXXXXX inchangé', () => {
    expect(toLocalMoroccanDigits('0612345678')).toBe('0612345678');
    expect(toLocalMoroccanDigits('06 12 34 56 78')).toBe('0612345678');
  });

  it('national 9 chiffres (sans 0) inchangé', () => {
    expect(toLocalMoroccanDigits('612345678')).toBe('612345678');
  });

  it('préserve la saisie progressive (ne strippe pas le 0 local)', () => {
    expect(toLocalMoroccanDigits('0')).toBe('0');
    expect(toLocalMoroccanDigits('06')).toBe('06');
    expect(toLocalMoroccanDigits('061')).toBe('061');
  });

  it('idempotent : f(f(x)) === f(x)', () => {
    const cases = ['+212612345678', '00212612345678', '0612345678', '612345678'];
    for (const c of cases) {
      expect(toLocalMoroccanDigits(toLocalMoroccanDigits(c))).toBe(toLocalMoroccanDigits(c));
    }
  });

  it('borne à 10 chiffres après normalisation', () => {
    // +212 + 9 digits = 0 + 9 digits = 10 (pas de surplus).
    expect(toLocalMoroccanDigits('+2126123456789999')).toHaveLength(10);
  });

  it('indicatif non marocain laissé tel quel (rejeté plus tard par la validation)', () => {
    // France +33 : pas de conversion → reste non-local, donc invalide côté Zod Maroc.
    expect(toLocalMoroccanDigits('+33612345678')).toBe('3361234567');
  });
});
