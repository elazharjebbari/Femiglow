import { describe, expect, it } from 'vitest';
import {
  describeMediaSetUsage,
  mediaSetUsageHref,
  type MediaSetUsageLike,
} from './media-set-usage';

const base: MediaSetUsageLike = {
  setId: 'cms_1',
  componentId: 'sc_1',
  componentKey: 'kit-hero-produit',
  slot: 'secondary',
  variantDim: 'angle',
  variantKey: 'e',
  locale: 'ar',
  status: 'published',
  version: 3,
};

describe('describeMediaSetUsage', () => {
  it('ensemble d’angle publié', () => {
    expect(describeMediaSetUsage(base)).toBe('kit-hero-produit · secondary · angle e · ar (publié v3)');
  });

  it('défaut, toutes langues, brouillon', () => {
    expect(
      describeMediaSetUsage({ ...base, variantDim: 'default', variantKey: '*', locale: '*', status: 'draft', version: 1 }),
    ).toBe('kit-hero-produit · secondary · défaut · toutes langues (brouillon v1)');
  });

  it('composant disparu : id du composant', () => {
    expect(describeMediaSetUsage({ ...base, componentKey: null, status: 'archived' })).toBe(
      'sc_1 · secondary · angle e · ar (archivé v3)',
    );
  });
});

describe('mediaSetUsageHref', () => {
  it('ancre l’onglet médias par audience', () => {
    expect(mediaSetUsageHref(base)).toBe('/admin/components/kit-hero-produit#medias-par-audience');
    expect(mediaSetUsageHref({ componentKey: null })).toBeNull();
  });
});
