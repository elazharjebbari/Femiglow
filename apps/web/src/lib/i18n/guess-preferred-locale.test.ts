/**
 * Lot L9 — tests de `guessPreferredLocale` + `parseAcceptLanguage`.
 * Couvre consensus, contradiction, q-weights, ad/utm, fail-safe (INV-20 :
 * pas de géoloc IP ; jamais de vote unique faible déclenchant à tort).
 */
import { describe, expect, it } from 'vitest';

import {
  guessPreferredLocale,
  parseAcceptLanguage,
} from './guess-preferred-locale';

describe('parseAcceptLanguage', () => {
  it('parse les q-weights et limite aux locales supportées', () => {
    expect(parseAcceptLanguage('ar-MA,ar;q=0.9,fr;q=0.8,de;q=0.5')).toEqual([
      { locale: 'ar', q: 1 }, // ar-MA → base ar, q par défaut 1 (max)
      { locale: 'fr', q: 0.8 },
    ]);
  });
  it('header vide / nul → []', () => {
    expect(parseAcceptLanguage('')).toEqual([]);
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage(undefined)).toEqual([]);
  });
});

describe('guessPreferredLocale', () => {
  it('consensus (cookie + accept + ad = ar) → ar, confiance haute', () => {
    const r = guessPreferredLocale({
      servedLocale: 'fr',
      cookieLocale: 'ar',
      acceptLanguages: [{ locale: 'ar', q: 0.9 }],
      adLocale: 'ar',
    });
    expect(r.guessedLocale).toBe('ar');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('contradiction (cookie fr vs accept ar) → fr (cookie prime), confiance modérée', () => {
    const r = guessPreferredLocale({
      servedLocale: 'fr',
      cookieLocale: 'fr',
      acceptLanguages: [{ locale: 'ar', q: 1 }],
    });
    expect(r.guessedLocale).toBe('fr');
    expect(r.confidence).toBeLessThan(0.8); // accord réduit par l'opposition
  });

  it('Accept-Language seul (faible) → locale correcte, confiance modérée', () => {
    const r = guessPreferredLocale({
      servedLocale: 'fr',
      acceptLanguages: parseAcceptLanguage('ar;q=0.9,fr;q=0.2'),
    });
    expect(r.guessedLocale).toBe('ar');
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThan(0.6); // pas un signal fort
  });

  it('langue de la créa (ad/utm) pèse', () => {
    const r = guessPreferredLocale({ servedLocale: 'fr', adLocale: 'en' });
    expect(r.guessedLocale).toBe('en');
  });

  it('aucun signal → langue servie, confiance 0 (jamais de proposition)', () => {
    const r = guessPreferredLocale({ servedLocale: 'fr' });
    expect(r).toMatchObject({ guessedLocale: 'fr', confidence: 0 });
  });

  it('signal invalide ignoré (pas de crash)', () => {
    const r = guessPreferredLocale({
      servedLocale: 'fr',
      // @ts-expect-error — locale non supportée volontaire
      cookieLocale: 'de',
      adLocale: 'ar',
    });
    expect(r.guessedLocale).toBe('ar');
    expect(r.evidence.every((v) => (v.locale as string) !== 'de')).toBe(true);
  });
});
