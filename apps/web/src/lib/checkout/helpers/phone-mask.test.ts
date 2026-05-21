/**
 * Tests du masque téléphone FR — helper pur.
 */
import { describe, it, expect } from 'vitest';

import { formatPhoneFR, parsePhoneFR } from './phone-mask';

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

  it('strip prefix +212 (chiffres uniquement)', () => {
    // Les 9 derniers digits ne sont pas notre rôle ici (c\'est Zod transform)
    // on garde les 10 premiers digits parsés.
    expect(formatPhoneFR('+212612345678')).toBe('21 26 12 34 56');
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
