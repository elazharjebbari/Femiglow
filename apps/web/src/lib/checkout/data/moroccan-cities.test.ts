/**
 * CHA-231 — Tests du matching bilingue FR/AR des villes marocaines.
 *
 * Couvre :
 *  - matchCity : FR canonique, FR avec accents/casse variables, AR canonique,
 *    AR avec tashkil et ال initial, aliases (FR + AR).
 *  - normalizeArabicKey : suppression tashkil, normalisation alef + ta marbuta.
 *  - searchCities : préfixe FR + préfixe AR.
 *  - Le résultat de matchCity est TOUJOURS la canonique FR (analytics +
 *    transporteurs FR-only).
 */
import { describe, it, expect } from 'vitest';

import {
  MOROCCAN_CITIES,
  findCityByValue,
  matchCity,
  normalizeArabicKey,
  normalizeCityKey,
  searchCities,
} from './moroccan-cities';

describe('moroccan-cities — matchCity (FR)', () => {
  it('matche la forme canonique FR', () => {
    expect(matchCity('Casablanca')?.value).toBe('casablanca');
    expect(matchCity('Rabat')?.value).toBe('rabat');
    expect(matchCity('Béni Mellal')?.value).toBe('beni-mellal');
  });

  it('ignore la casse', () => {
    expect(matchCity('casablanca')?.value).toBe('casablanca');
    expect(matchCity('CASABLANCA')?.value).toBe('casablanca');
    expect(matchCity('CaSaBlAnCa')?.value).toBe('casablanca');
  });

  it('ignore les accents', () => {
    expect(matchCity('Fes')?.value).toBe('fes');
    expect(matchCity('Fès')?.value).toBe('fes');
    expect(matchCity('Beni Mellal')?.value).toBe('beni-mellal');
    expect(matchCity('Kenitra')?.value).toBe('kenitra');
    expect(matchCity('Kénitra')?.value).toBe('kenitra');
  });

  it('reconnaît les alias FR', () => {
    expect(matchCity('Casa')?.value).toBe('casablanca');
    expect(matchCity('Dar el Beida')?.value).toBe('casablanca');
    expect(matchCity('Mogador')?.value).toBe('essaouira');
    expect(matchCity('Fez')?.value).toBe('fes');
  });

  it('retourne null pour une saisie inconnue', () => {
    expect(matchCity('Paris')).toBeNull();
    expect(matchCity('xyz')).toBeNull();
    expect(matchCity('')).toBeNull();
  });
});

describe('moroccan-cities — matchCity (AR)', () => {
  it('matche la forme canonique AR', () => {
    expect(matchCity('الدار البيضاء')?.value).toBe('casablanca');
    expect(matchCity('الرباط')?.value).toBe('rabat');
    expect(matchCity('فاس')?.value).toBe('fes');
    expect(matchCity('مراكش')?.value).toBe('marrakech');
  });

  it('tolère le retrait du ال initial', () => {
    expect(matchCity('دار البيضاء')?.value).toBe('casablanca');
    expect(matchCity('رباط')?.value).toBe('rabat');
  });

  it('tolère les tashkil (vocalisation)', () => {
    expect(matchCity('الدّارُ البَيضَاء')?.value).toBe('casablanca');
    expect(matchCity('الرِّبَاط')?.value).toBe('rabat');
  });

  it('normalise les variantes de alef et ta marbuta', () => {
    // أ → ا
    expect(matchCity('أكادير')?.value).toBe('agadir');
    // آ → ا (alias)
    expect(matchCity('آسفي')?.value).toBe('safi');
  });

  it('retourne la canonique FR — pas le label AR', () => {
    // Garantit que le serveur reçoit toujours le label FR même si l'utilisateur
    // a tapé en arabe (analytics + transporteurs FR-only).
    expect(matchCity('الدار البيضاء')?.label).toBe('Casablanca');
    expect(matchCity('الرباط')?.label).toBe('Rabat');
  });
});

describe('moroccan-cities — normalizeArabicKey', () => {
  it('retire les tashkil', () => {
    expect(normalizeArabicKey('الدّارُ')).toBe('دار');
    expect(normalizeArabicKey('الرِّبَاط')).toBe('رباط');
  });

  it('retire le ال initial', () => {
    expect(normalizeArabicKey('الرباط')).toBe('رباط');
    expect(normalizeArabicKey('الدار')).toBe('دار');
  });

  it('normalise les variantes de alef', () => {
    expect(normalizeArabicKey('أكادير')).toBe('اكادير');
    expect(normalizeArabicKey('إكادير')).toBe('اكادير');
    expect(normalizeArabicKey('آكادير')).toBe('اكادير');
  });

  it('normalise la ta marbuta vers ha', () => {
    expect(normalizeArabicKey('مدينة')).toBe('مدينه');
  });

  it('retire les ZWJ/ZWNJ et la BOM', () => {
    expect(normalizeArabicKey('الرباط\u200B')).toBe('رباط');
    expect(normalizeArabicKey('\uFEFFالرباط')).toBe('رباط');
  });
});

describe('moroccan-cities — searchCities', () => {
  it('retourne les premières villes pour une requête vide', () => {
    const res = searchCities('', 3);
    expect(res).toHaveLength(3);
    expect(res[0]?.value).toBe(MOROCCAN_CITIES[0]?.value);
  });

  it('matche par préfixe FR', () => {
    const res = searchCities('Casa');
    expect(res.find((c) => c.value === 'casablanca')).toBeDefined();
  });

  it('matche par préfixe AR', () => {
    const res = searchCities('الد');
    expect(res.find((c) => c.value === 'casablanca')).toBeDefined();
  });

  it('respecte la limite', () => {
    const res = searchCities('', 5);
    expect(res.length).toBeLessThanOrEqual(5);
  });
});

describe('moroccan-cities — normalizeCityKey', () => {
  it('retire les accents et lowercase', () => {
    expect(normalizeCityKey('Béni Mellal')).toBe('beni mellal');
    expect(normalizeCityKey('Fès')).toBe('fes');
    expect(normalizeCityKey('  Kénitra  ')).toBe('kenitra');
  });
});

describe('moroccan-cities — findCityByValue', () => {
  it('retourne une ville par slug', () => {
    expect(findCityByValue('casablanca')?.label).toBe('Casablanca');
    expect(findCityByValue('rabat')?.label).toBe('Rabat');
  });

  it('retourne null pour un slug inconnu', () => {
    expect(findCityByValue('paris')).toBeNull();
  });
});

describe('moroccan-cities — invariants de la liste', () => {
  it('tous les slugs sont uniques', () => {
    const values = MOROCCAN_CITIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('tous les labels AR sont présents', () => {
    for (const c of MOROCCAN_CITIES) {
      expect(c.labelAr).toBeTruthy();
      expect(c.labelAr.length).toBeGreaterThan(0);
    }
  });

  it('au moins une ville express-eligible (sanity)', () => {
    expect(MOROCCAN_CITIES.some((c) => c.expressEligible)).toBe(true);
  });
});
