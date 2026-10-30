/**
 * Tests — `pickHeroVariantUrl` (extrait de `kit-hero-gallery.ts`, comportement
 * inchangé : taille xl > lg > md > sm > xs, puis format webp > avif > jpeg,
 * sinon premier variant, sinon null).
 */
import { describe, expect, it } from 'vitest';
import { pickHeroVariantUrl, type PickableVariant } from './pick-variant';

const v = (breakpoint: string | null, format: string, url = `/${breakpoint}.${format}`): PickableVariant => ({
  breakpoint,
  format,
  url,
});

describe('pickHeroVariantUrl', () => {
  it('null / sans variants → null', () => {
    expect(pickHeroVariantUrl(null)).toBeNull();
    expect(pickHeroVariantUrl(undefined)).toBeNull();
    expect(pickHeroVariantUrl({})).toBeNull();
    expect(pickHeroVariantUrl({ variants: [] })).toBeNull();
  });

  it('la plus grande taille gagne avant le format', () => {
    expect(pickHeroVariantUrl({ variants: [v('lg', 'webp'), v('xl', 'jpeg')] })).toBe('/xl.jpeg');
  });

  it('à taille égale : webp > avif > jpeg', () => {
    expect(pickHeroVariantUrl({ variants: [v('lg', 'jpeg'), v('lg', 'avif'), v('lg', 'webp')] })).toBe(
      '/lg.webp',
    );
    expect(pickHeroVariantUrl({ variants: [v('lg', 'jpeg'), v('lg', 'avif')] })).toBe('/lg.avif');
  });

  it('ignore une variant correspondante sans URL et continue', () => {
    expect(pickHeroVariantUrl({ variants: [v('xl', 'webp', ''), v('lg', 'webp')] })).toBe('/lg.webp');
  });

  it('aucune correspondance stricte (breakpoint null, format inconnu) → premier variant', () => {
    expect(pickHeroVariantUrl({ variants: [v(null, 'mp4', '/a.mp4'), v('2xl', 'png', '/b.png')] })).toBe(
      '/a.mp4',
    );
  });
});
