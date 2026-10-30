/**
 * Tests — politique « médias par audience » du registre, dimensions et
 * validation de forme d'un ensemble.
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.2
 */
import { describe, expect, it } from 'vitest';
import {
  KIT_HERO_MEDIA_VARIANTS,
  SITE_COMPONENT_REGISTRY,
  findComponentSeed,
} from '@/lib/components/registry';
import { validateFieldValue } from '@/lib/components/fields/validators';
import { encodeValue } from '@/lib/components/fields/encoding';
import { KIT_ANGLES } from '@/lib/kit/angle';
import { getDimension, isValidVariantKey, parseAbDimension } from './dimensions';
import {
  readMediaVariantPolicy,
  slotMaxItems,
  validateMediaSetShape,
  validateMediaVariantPolicy,
} from './policy';

describe('registre — politiques mediaVariants', () => {
  it('toute politique déclarée est valide et ses legacySlots existent dans le composant', () => {
    const withPolicy = SITE_COMPONENT_REGISTRY.filter((c) => c.mediaVariants);
    expect(withPolicy.map((c) => c.key)).toContain('kit-hero-produit');
    for (const c of withPolicy) {
      const issues = validateMediaVariantPolicy(c.mediaVariants!, c.slots.map((s) => s.key));
      expect(issues, c.key).toEqual([]);
    }
  });

  it('kit-hero-produit : primary single + secondary list (6), 3/4 mobile, 4/5 desktop, angle', () => {
    const seed = findComponentSeed('kit-hero-produit')!;
    expect(seed.mediaVariants).toBe(KIT_HERO_MEDIA_VARIANTS);
    const [primary, secondary] = KIT_HERO_MEDIA_VARIANTS.slots;
    expect(primary).toMatchObject({ key: 'primary', kind: 'single', legacySlots: ['primary'] });
    expect(secondary).toMatchObject({
      key: 'secondary',
      kind: 'list',
      maxItems: 6,
      legacySlots: ['context_1', 'context_2'],
    });
    for (const s of KIT_HERO_MEDIA_VARIANTS.slots) {
      expect(s.aspect).toEqual({ mobile: '3/4', desktop: '4/5' });
    }
    expect(KIT_HERO_MEDIA_VARIANTS.dimensions).toEqual(['angle']);
  });

  it('kit-hero-produit : champ booléen mediaVariantsEnabled, défaut false, validé', () => {
    const field = findComponentSeed('kit-hero-produit')!.fields!.find(
      (f) => f.key === 'mediaVariantsEnabled',
    )!;
    expect(field).toMatchObject({ type: 'boolean', required: false, defaultValue: false });
    // Valeur encodée (`{ v }`) comme la stockent les bindings.
    expect(validateFieldValue(field, encodeValue(field.defaultValue, 'boolean')).ok).toBe(true);
    expect(validateFieldValue(field, encodeValue(true, 'boolean')).ok).toBe(true);
    expect(validateFieldValue(field, { v: 'yes' }).ok).toBe(false);
  });

  it('les clés de champ de kit-hero-produit restent uniques', () => {
    const keys = findComponentSeed('kit-hero-produit')!.fields!.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('validateMediaVariantPolicy', () => {
  it('signale legacySlots inconnu, dimension inconnue, doublons, liste sans maxItems', () => {
    const issues = validateMediaVariantPolicy(
      {
        slots: [
          { key: 'a', kind: 'list', aspect: { all: '1/1' }, legacySlots: ['nope'] },
          { key: 'a', kind: 'single', aspect: { all: '1/1' } },
        ],
        dimensions: ['angle', 'angle', 'city', 'default'],
      },
      ['primary'],
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        'slot.duplicate:a',
        'slot.max_items_missing:a',
        'slot.legacy_unknown:a->nope',
        'dimension.duplicate:angle',
        'dimension.unknown:city',
        'dimension.default_is_implicit',
      ]),
    );
  });
});

describe('readMediaVariantPolicy', () => {
  it('relit la politique depuis metadata ; null si absente ou malformée', () => {
    expect(readMediaVariantPolicy({ mediaVariants: KIT_HERO_MEDIA_VARIANTS })).toEqual(
      KIT_HERO_MEDIA_VARIANTS,
    );
    expect(readMediaVariantPolicy({ animationProfile: 'x' })).toBeNull();
    expect(readMediaVariantPolicy({ mediaVariants: { slots: 'oops' } })).toBeNull();
    expect(readMediaVariantPolicy(null)).toBeNull();
  });
});

describe('dimensions', () => {
  it('angle → KIT_ANGLES', () => {
    expect(getDimension('angle')?.values).toEqual(KIT_ANGLES);
    for (const a of KIT_ANGLES) expect(isValidVariantKey('angle', a)).toBe(true);
    expect(isValidVariantKey('angle', 'f')).toBe(false);
  });

  it('ab:<key> générique : forme validée, bras dynamiques', () => {
    expect(parseAbDimension('ab:hero-media-2026-11')).toBe('hero-media-2026-11');
    expect(parseAbDimension('ab:')).toBeNull();
    expect(parseAbDimension('ab:Bad Key')).toBeNull();
    expect(getDimension('ab:hero-media-2026-11')?.values).toBeNull();
    expect(isValidVariantKey('ab:hero-media-2026-11', 'b')).toBe(true);
    expect(isValidVariantKey('ab:hero-media-2026-11', '*')).toBe(false);
  });

  it('default n’accepte que *', () => {
    expect(isValidVariantKey('default', '*')).toBe(true);
    expect(isValidVariantKey('default', 'e')).toBe(false);
    expect(getDimension('city')).toBeNull();
  });
});

describe('validateMediaSetShape', () => {
  const base = { slot: 'primary', variantDim: 'angle', variantKey: 'e', locale: 'ar', items: [{ mediaId: 'm' }] };

  it('accepte un ensemble conforme', () => {
    expect(validateMediaSetShape(KIT_HERO_MEDIA_VARIANTS, base)).toEqual([]);
  });

  it.each([
    [{ items: [{ mediaId: 'm', focalX: 101 }] }, 'item.focal_invalid'],
    [{ items: [{ mediaId: 'm', alt: { de: 'x' } }] }, 'item.alt_locale'],
    [{ items: [{ mediaId: 'm', alt: { fr: 'x'.repeat(301) } }] }, 'item.alt_invalid'],
    [{ items: [{ mediaId: '' }] }, 'item.media_missing'],
  ])('%j → %s', (patch, code) => {
    const issues = validateMediaSetShape(KIT_HERO_MEDIA_VARIANTS, { ...base, ...patch });
    expect(issues.map((i) => i.code)).toContain(code);
  });

  it('slotMaxItems : single = 1, list = maxItems', () => {
    expect(slotMaxItems(KIT_HERO_MEDIA_VARIANTS.slots[0]!)).toBe(1);
    expect(slotMaxItems(KIT_HERO_MEDIA_VARIANTS.slots[1]!)).toBe(6);
  });
});
