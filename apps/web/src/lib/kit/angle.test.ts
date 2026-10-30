/**
 * Tests de la normalisation de l'angle publicitaire (Kit CRO v2 §3).
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  KIT_ANGLES,
  isKitAngle,
  kitAngleTrackingValue,
  normalizeKitAngle,
  readKitAngleFromDocument,
  resolveKitAngle,
} from './angle';

describe('normalizeKitAngle', () => {
  it.each([
    ['A-darija', 'a'],
    ['a-darija', 'a'],
    ['B-fr', 'b'],
    ['C_semi-permanent', 'c'],
    ['D-rien-a-retirer-woudou_fr', 'd'],
    ['E-fr', 'e'],
    ['E-darija', 'e'],
    ['E_salon-ou-99dh_darija', 'e'],
    ['e', 'e'],
    ['A', 'a'],
    ['  A-darija  ', 'a'],
    ['a-', 'a'],
    ['b_', 'b'],
  ])('« %s » → %s', (raw, expected) => {
    expect(normalizeKitAngle(raw)).toBe(expected);
  });

  it.each([
    ['temoin-manucure-chine', 'temoin'],
    ['temoin', 'temoin'],
    ['Temoin_FR', 'temoin'],
    ['TÉMOIN-manucure', 'temoin'],
    ['témoin-manucure-chine', 'temoin'],
    ['temoinfr', 'temoin'],
  ])('« %s » → témoin', (raw, expected) => {
    expect(normalizeKitAngle(raw)).toBe(expected);
  });

  it.each([
    'F-darija',
    'z',
    'abc',
    'ab-darija',
    'Ad-darija',
    'darija-A',
    '1-a',
    '-a',
    '_a',
    'retargeting',
    'manucure-temoin',
    '',
    '   ',
    '{{ad.name}}',
  ])('« %s » → aucun angle', (raw) => {
    expect(normalizeKitAngle(raw)).toBeNull();
  });

  it('ignore les caractères hors [a-z0-9_-]', () => {
    // Espace retiré : « A darija » devient « adarija », qui n'est pas un angle.
    expect(normalizeKitAngle('A darija')).toBeNull();
    expect(normalizeKitAngle('A-dar ija')).toBe('a');
    expect(normalizeKitAngle('E-<script>')).toBe('e');
    expect(normalizeKitAngle('"E"')).toBe('e');
    expect(normalizeKitAngle('%%')).toBeNull();
  });

  it('tronque à 80 caractères avant de lire', () => {
    expect(normalizeKitAngle(`E-${'x'.repeat(200)}`)).toBe('e');
    // Les 80 premiers caractères seulement : la lettre finale est ignorée.
    expect(normalizeKitAngle(`${' '.repeat(0)}${'x'.repeat(80)}a`)).toBeNull();
  });

  it('accepte un paramètre répété (tableau) : première valeur', () => {
    expect(normalizeKitAngle(['C-fr', 'A-fr'])).toBe('c');
    expect(normalizeKitAngle(['nope', 'A-fr'])).toBeNull();
    expect(normalizeKitAngle([])).toBeNull();
  });

  it('refuse tout ce qui n’est pas une chaîne', () => {
    expect(normalizeKitAngle(undefined)).toBeNull();
    expect(normalizeKitAngle(null)).toBeNull();
    expect(normalizeKitAngle(42)).toBeNull();
    expect(normalizeKitAngle({ a: 1 })).toBeNull();
  });

  it('chaque angle connu se normalise sur lui-même', () => {
    for (const angle of KIT_ANGLES) expect(normalizeKitAngle(angle)).toBe(angle);
  });
});

describe('isKitAngle', () => {
  it('reconnaît les six angles et rien d’autre', () => {
    for (const angle of KIT_ANGLES) expect(isKitAngle(angle)).toBe(true);
    expect(isKitAngle('A')).toBe(false);
    expect(isKitAngle('f')).toBe(false);
    expect(isKitAngle('none')).toBe(false);
    expect(isKitAngle(undefined)).toBe(false);
  });
});

describe('resolveKitAngle', () => {
  it('?angle= prime sur utm_content et le cookie', () => {
    expect(resolveKitAngle({ angleParam: 'b', utmContent: 'E-fr', cookie: 'c' })).toEqual({
      angle: 'b',
      source: 'query',
    });
  });

  it('utm_content prime sur le cookie', () => {
    expect(resolveKitAngle({ utmContent: 'E-darija', cookie: 'a' })).toEqual({
      angle: 'e',
      source: 'utm',
    });
  });

  it('retombe sur le cookie sans paramètre d’URL', () => {
    expect(resolveKitAngle({ cookie: 'temoin' })).toEqual({ angle: 'temoin', source: 'cookie' });
  });

  it('ignore une valeur d’URL non reconnue et passe à la source suivante', () => {
    expect(resolveKitAngle({ angleParam: 'zzz', utmContent: 'retargeting', cookie: 'd' })).toEqual({
      angle: 'd',
      source: 'cookie',
    });
  });

  it('aucun angle', () => {
    expect(resolveKitAngle({})).toEqual({ angle: null, source: null });
    expect(resolveKitAngle({ cookie: 'garbage' })).toEqual({ angle: null, source: null });
  });
});

describe('kitAngleTrackingValue', () => {
  it('renvoie l’angle ou « none »', () => {
    expect(kitAngleTrackingValue('e')).toBe('e');
    expect(kitAngleTrackingValue(null)).toBe('none');
    expect(kitAngleTrackingValue(undefined)).toBe('none');
  });
});

describe('readKitAngleFromDocument', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('null sans attribut (hors /kit)', () => {
    expect(readKitAngleFromDocument()).toBeNull();
  });

  it('lit l’angle posé par le hero', () => {
    document.body.innerHTML = '<section data-kit-angle="e"></section>';
    expect(readKitAngleFromDocument()).toBe('e');
  });

  it('lit « none » sans angle', () => {
    document.body.innerHTML = '<section data-kit-angle="none"></section>';
    expect(readKitAngleFromDocument()).toBe('none');
  });

  it('ignore une valeur inconnue', () => {
    document.body.innerHTML = '<section data-kit-angle="zz"></section>';
    expect(readKitAngleFromDocument()).toBeNull();
  });
});
