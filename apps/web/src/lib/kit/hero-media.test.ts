import { afterEach, describe, expect, it } from 'vitest';
import {
  heroMediaDataAttributes,
  heroMediaTrackingParams,
  isHeroMediaVariantValue,
  readHeroMediaTrackingFromDocument,
  readHeroMediaVariantFromDocument,
} from './hero-media';
import { traceTrackingValue } from '@/lib/components/media-variants/tracking';

afterEach(() => {
  document.body.innerHTML = '';
});

function hero(attrs: Record<string, string>) {
  const el = document.createElement('section');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
}

describe('isHeroMediaVariantValue', () => {
  it('accepte tous les formats produits par mediaVariantTrackingValue', () => {
    const base = { slot: 'primary', setId: 's', level: 1 as const };
    const values = [
      traceTrackingValue({ ...base, variantDim: 'angle', variantKey: 'e', locale: 'ar', version: 3 }),
      traceTrackingValue({ ...base, variantDim: 'angle', variantKey: 'temoin', locale: '*', version: 2 }),
      traceTrackingValue({ ...base, variantDim: 'default', variantKey: '*', locale: 'fr', version: 1 }),
      traceTrackingValue({
        ...base,
        variantDim: `ab:${'x'.repeat(64)}`,
        variantKey: `${'b_'.repeat(32)}`,
        locale: 'en',
        version: 120,
      }),
      'legacy',
      'product',
    ];
    expect(values.slice(0, 3)).toEqual(['angle-e.ar.v3', 'angle-temoin.any.v2', 'default.fr.v1']);
    for (const v of values) expect(isHeroMediaVariantValue(v)).toBe(true);
  });

  it('rejette vide, majuscules, espaces, balises et valeurs trop longues', () => {
    for (const v of ['', 'Angle-E', 'a b', '<x>', 'a'.repeat(161), null, 3]) {
      expect(isHeroMediaVariantValue(v)).toBe(false);
    }
  });
});

describe('heroMediaTrackingParams / heroMediaDataAttributes', () => {
  it('drapeau coupé (null) : rien', () => {
    expect(heroMediaTrackingParams(null)).toEqual({});
    expect(heroMediaDataAttributes(null)).toEqual({});
    expect(heroMediaDataAttributes(undefined)).toEqual({});
  });

  it('variante + niveau', () => {
    expect(heroMediaTrackingParams({ variant: 'legacy', level: 7 })).toEqual({
      hero_media_variant: 'legacy',
      hero_media_level: 7,
    });
    expect(heroMediaDataAttributes({ variant: 'angle-e.fr.v1', level: 1 })).toEqual({
      'data-hero-media-variant': 'angle-e.fr.v1',
      'data-hero-media-level': '1',
    });
  });

  it('niveau invalide omis ; variante invalide → tout omis', () => {
    expect(heroMediaTrackingParams({ variant: 'legacy', level: 9 })).toEqual({ hero_media_variant: 'legacy' });
    expect(heroMediaTrackingParams({ variant: 'BAD VALUE', level: 1 })).toEqual({});
  });
});

describe('lecture depuis le DOM', () => {
  it('hors /kit : null / {}', () => {
    expect(readHeroMediaVariantFromDocument()).toBeNull();
    expect(readHeroMediaTrackingFromDocument()).toEqual({});
  });

  it('lit variante et niveau posés par le hero', () => {
    hero({ 'data-hero-media-variant': 'angle-e.ar.v3', 'data-hero-media-level': '1' });
    expect(readHeroMediaVariantFromDocument()).toBe('angle-e.ar.v3');
    expect(readHeroMediaTrackingFromDocument()).toEqual({
      hero_media_variant: 'angle-e.ar.v3',
      hero_media_level: 1,
    });
  });

  it('valeur altérée ignorée', () => {
    hero({ 'data-hero-media-variant': 'x"><script>', 'data-hero-media-level': '1' });
    expect(readHeroMediaTrackingFromDocument()).toEqual({});
  });
});
