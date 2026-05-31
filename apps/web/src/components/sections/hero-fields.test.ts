/**
 * Vitest — `mergeHeroFields` (P12 — pilote home-hero).
 *
 * Couvre :
 *   - cascade `binding` remplace `data`,
 *   - cascade `default` remplace `data` (intention : ne pas régresser
 *     visuellement après seed initial même sans binding manuel),
 *   - cascade `none` laisse `data` intact,
 *   - CTAs invalides (label/href manquant) ignorés,
 *   - `image, variant` jamais modifiés.
 */
import { describe, it, expect } from 'vitest';
import { mergeHeroFields } from './hero-fields';
import type { Hero as HeroData } from '@/lib/schemas';
import type { ResolvedFields } from '@/lib/db/types';

const baseData: HeroData = {
  variant: 'editorial',
  kicker: 'Mock kicker',
  title: 'Mock title',
  subtitle: 'Mock subtitle',
  cta: { label: 'Mock CTA', href: '/mock', variant: 'primary' },
  ctaSecondary: { label: 'Mock CTA 2', href: '/mock2', variant: 'link' },
  image: {
    src: '/img.svg',
    alt: 'alt',
    width: 100,
    height: 200,
  },
};

describe('mergeHeroFields', () => {
  it('overrides scalar fields with binding values', () => {
    const fields: ResolvedFields = {
      kicker: { value: 'CMS kicker', meta: { source: 'binding', version: 1, locale: 'fr' } },
      title: { value: 'CMS title', meta: { source: 'binding', version: 2, locale: 'fr' } },
      subtitle: { value: 'CMS subtitle', meta: { source: 'binding', version: 3, locale: 'fr' } },
    };
    const out = mergeHeroFields(baseData, fields);
    expect(out.kicker).toBe('CMS kicker');
    expect(out.title).toBe('CMS title');
    expect(out.subtitle).toBe('CMS subtitle');
  });

  it('overrides scalar fields with default values (post-seed visual parity)', () => {
    const fields: ResolvedFields = {
      title: { value: 'Default title', meta: { source: 'default', version: 0, locale: 'fr' } },
    };
    const out = mergeHeroFields(baseData, fields);
    expect(out.title).toBe('Default title');
    // unaffected fields fall back to data
    expect(out.kicker).toBe('Mock kicker');
  });

  it("leaves data intact when source='none'", () => {
    const fields: ResolvedFields = {
      kicker: { value: null, meta: { source: 'none', version: 0, locale: 'fr' } },
      title: { value: null, meta: { source: 'none', version: 0, locale: 'fr' } },
    };
    const out = mergeHeroFields(baseData, fields);
    expect(out.kicker).toBe('Mock kicker');
    expect(out.title).toBe('Mock title');
  });

  it('replaces cta when binding is a valid CTA', () => {
    const fields: ResolvedFields = {
      cta: {
        value: { label: 'New label', href: '/new', variant: 'secondary' },
        meta: { source: 'binding', version: 1, locale: 'fr' },
      },
    };
    const out = mergeHeroFields(baseData, fields);
    expect(out.cta).toEqual({ label: 'New label', href: '/new', variant: 'secondary' });
  });

  it('falls back to data when CTA binding is invalid (missing href)', () => {
    const fields: ResolvedFields = {
      cta: {
        value: { label: 'Incomplete' },
        meta: { source: 'binding', version: 1, locale: 'fr' },
      },
    };
    const out = mergeHeroFields(baseData, fields);
    expect(out.cta).toEqual(baseData.cta);
  });

  it('falls back to data when CTA value is null', () => {
    const fields: ResolvedFields = {
      cta: { value: null, meta: { source: 'none', version: 0, locale: 'fr' } },
    };
    const out = mergeHeroFields(baseData, fields);
    expect(out.cta).toEqual(baseData.cta);
  });

  it('never touches image or variant', () => {
    const fields: ResolvedFields = {
      title: { value: 'CMS title', meta: { source: 'binding', version: 1, locale: 'fr' } },
    };
    const out = mergeHeroFields(baseData, fields);
    expect(out.image).toEqual(baseData.image);
    expect(out.variant).toBe(baseData.variant);
  });

  it('treats empty / whitespace-only string as no override', () => {
    const fields: ResolvedFields = {
      title: { value: '   ', meta: { source: 'binding', version: 1, locale: 'fr' } },
    };
    const out = mergeHeroFields(baseData, fields);
    expect(out.title).toBe('Mock title');
  });

  // Phase 7B — locale-aware merge.
  describe('locale-aware merge (Phase 7B)', () => {
    it('preserves data when locale is non-default and source is default', () => {
      // Cas type : AR avec mock localisé `data.title = 'كيت...'` et
      // `fields.title = { value: 'Le rituel...', source: 'default' }`.
      // → on doit garder `data.title` (AR).
      const fields: ResolvedFields = {
        title: { value: 'Le rituel ongles, en cinq minutes.', meta: { source: 'default', version: 0, locale: 'ar' } },
        kicker: { value: 'Maison de Rabat', meta: { source: 'default', version: 0, locale: 'ar' } },
      };
      const dataAr: HeroData = {
        ...baseData,
        title: 'كيت فيمي قلو. حركتان، إشراق مكشوف.',
        kicker: 'دار الرباط',
      };
      const out = mergeHeroFields(dataAr, fields, { locale: 'ar' });
      expect(out.title).toBe('كيت فيمي قلو. حركتان، إشراق مكشوف.');
      expect(out.kicker).toBe('دار الرباط');
    });

    it('accepts binding values in non-default locale (seed delivered)', () => {
      const fields: ResolvedFields = {
        title: { value: 'كيت محدّث', meta: { source: 'binding', version: 1, locale: 'ar' } },
      };
      const dataAr: HeroData = { ...baseData, title: 'وحدة fallback' };
      const out = mergeHeroFields(dataAr, fields, { locale: 'ar' });
      // bindings AR ont priorité même en non-default locale.
      expect(out.title).toBe('كيت محدّث');
    });

    it('accepts default values when locale equals defaultLocale (FR)', () => {
      const fields: ResolvedFields = {
        title: { value: 'Title FR defaut', meta: { source: 'default', version: 0, locale: 'fr' } },
      };
      const out = mergeHeroFields(baseData, fields, { locale: 'fr' });
      expect(out.title).toBe('Title FR defaut');
    });

    it('back-compat: no options → comportement historique (default accepté)', () => {
      const fields: ResolvedFields = {
        title: { value: 'Title FR defaut', meta: { source: 'default', version: 0, locale: 'fr' } },
      };
      const out = mergeHeroFields(baseData, fields);
      expect(out.title).toBe('Title FR defaut');
    });

    it('rejects default CTA in non-default locale', () => {
      const fields: ResolvedFields = {
        cta: {
          value: { label: 'Découvrir le rituel', href: '/rituel', variant: 'primary' },
          meta: { source: 'default', version: 0, locale: 'ar' },
        },
      };
      const dataAr: HeroData = {
        ...baseData,
        cta: { label: 'اكتشفي الطقوس', href: '/rituel', variant: 'primary' },
      };
      const out = mergeHeroFields(dataAr, fields, { locale: 'ar' });
      expect(out.cta?.label).toBe('اكتشفي الطقوس');
    });
  });
});
