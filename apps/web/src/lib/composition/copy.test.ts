/**
 * Tests des helpers de copy `lib/composition/copy.ts`.
 *
 * Couvre les 4 fonctions pures utilisées par `CompositionCard` :
 *  - `buildCardHeader` (titre + volume inline),
 *  - `formatSensation` (encadrement guillemets français),
 *  - `formatIndex` (pastille 2 digits zero-padded),
 *  - `resolveAccentHex` (mapping enum → hex palette).
 */
import { describe, expect, it } from 'vitest';

import type { SubProduct } from '@/lib/schemas';

import {
  buildCardHeader,
  formatIndex,
  formatSensation,
  resolveAccentHex,
} from './copy';

function makeSub(overrides: Partial<SubProduct> = {}): SubProduct {
  return {
    id: '1-paste',
    name: '1 Paste',
    shortDescription: 'desc',
    volume: '15 g',
    image: { src: '/p.jpg', alt: 'p', width: 1, height: 1 },
    ingredients: [
      { name: 'x', inci: 'x', function: 'x', origin: 'x' },
    ],
    certifications: [],
    ...overrides,
  } as SubProduct;
}

describe('buildCardHeader', () => {
  it('compose "Name · volume"', () => {
    expect(buildCardHeader(makeSub())).toBe('1 Paste · 15 g');
  });

  it('lowercase le volume (15 G → 15 g)', () => {
    expect(buildCardHeader(makeSub({ volume: '15 G' }))).toBe('1 Paste · 15 g');
  });

  it('trim les espaces autour du volume', () => {
    expect(buildCardHeader(makeSub({ volume: '   90 mm   ' }))).toBe('1 Paste · 90 mm');
  });

  it('omet le séparateur si volume vide (robustesse)', () => {
    expect(buildCardHeader(makeSub({ volume: '   ' }))).toBe('1 Paste');
  });
});

describe('formatSensation', () => {
  it('encadre par « … » si sensation présente', () => {
    expect(formatSensation(makeSub({ sensation: 'Tiède au contact.' }))).toBe(
      '« Tiède au contact. »',
    );
  });

  it('trim avant d\'encadrer', () => {
    expect(formatSensation(makeSub({ sensation: '  Glisse. ' as never }))).toBe('« Glisse. »');
  });

  it('retourne null si sensation absente', () => {
    expect(formatSensation(makeSub())).toBeNull();
  });
});

describe('formatIndex', () => {
  it('pad 0 → "01"', () => {
    expect(formatIndex(0)).toBe('01');
  });

  it('pad 1 → "02"', () => {
    expect(formatIndex(1)).toBe('02');
  });

  it('pad 9 → "10"', () => {
    expect(formatIndex(9)).toBe('10');
  });

  it('safe sur input négatif → "01"', () => {
    expect(formatIndex(-5)).toBe('01');
  });

  it('clamp à 99 pour les inputs > 99 (résultat "100" après +1)', () => {
    // safe = min(99, 150) = 99 ; safe + 1 = 100 ; padded → '100'.
    expect(formatIndex(150)).toBe('100');
  });
});

describe('resolveAccentHex', () => {
  it('mappe sauge → #A8B89E', () => {
    expect(resolveAccentHex('sauge')).toBe('#A8B89E');
  });

  it('mappe petale, ciel, champagne', () => {
    expect(resolveAccentHex('petale')).toBe('#F2CECC');
    expect(resolveAccentHex('ciel')).toBe('#C5DBE5');
    expect(resolveAccentHex('champagne')).toBe('#B8956B');
  });

  it('fallback champagne pour undefined / null', () => {
    expect(resolveAccentHex(undefined)).toBe('#B8956B');
    expect(resolveAccentHex(null)).toBe('#B8956B');
  });
});
