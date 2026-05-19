/**
 * Tests `resolvePageWithComponents`.
 *
 * Couvre :
 *  - Flag désactivé → identique à `resolveSeoMetadata(page)` + `componentOverrides: []`.
 *  - Aucun composant → idem.
 *  - Composant publié → ses champs `overridable` écrasent la page.
 *  - `overridableFields` restreint le périmètre d'écrasement.
 *  - Plusieurs composants : le dernier de la liste gagne sur les précédents.
 *  - Composant sans override en DB → trace `source: 'none'`, pas d'effet.
 *  - DB throw → fallback silencieux sur la page seule.
 *  - `og.image` (mediaId) jamais écrasé par un composant (invariant).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/seo/resolve', () => ({
  resolveSeoMetadata: vi.fn(),
  SEO_TAG: 'seo',
  seoTargetTag: (s: string, k: string) => `seo:${s}:${k}`,
}));
vi.mock('@/lib/db/queries/seo', () => ({
  getActiveComponentOverrides: vi.fn(),
}));

import { resolveSeoMetadata } from '@/lib/seo/resolve';
import { getActiveComponentOverrides } from '@/lib/db/queries/seo';
import { resolvePageWithComponents } from './component-resolve';
import type { ResolvedSeoMetadata, SeoOverride } from './types';

const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES;

afterEach(() => {
  process.env.NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES = ORIGINAL_FLAG;
});

function makeResolved(over: Partial<ResolvedSeoMetadata> = {}): ResolvedSeoMetadata {
  return {
    title: 'Page title',
    description: 'Page description',
    canonical: null,
    robots: { index: true, follow: true },
    og: {
      title: 'OG page',
      description: 'OG page desc',
      image: null,
      template: null,
    },
    twitter: { card: 'summary_large_image', handle: null },
    keywords: [],
    structuredData: null,
    source: 'override',
    ...over,
  };
}

function makeOverride(over: Partial<SeoOverride> & { targetKey: string }): SeoOverride {
  return {
    id: 'ov_test',
    scope: 'component',
    locale: 'fr-MA',
    title: null,
    description: null,
    keywords: [],
    ogTitle: null,
    ogDescription: null,
    ogImageMediaId: null,
    ogImageTemplate: null,
    twitterCard: 'summary_large_image',
    canonical: null,
    robotsIndex: true,
    robotsFollow: true,
    structuredData: null,
    publishedAt: new Date(),
    draftedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    ...over,
  } as SeoOverride;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolvePageWithComponents — flag désactivé', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES = 'false';
  });

  it('retourne la page seule + componentOverrides=[]', async () => {
    const page = makeResolved({ title: 'Page T' });
    vi.mocked(resolveSeoMetadata).mockResolvedValue(page);

    const result = await resolvePageWithComponents({
      pageScope: 'product',
      pageTargetKey: 'le-kit',
      components: [{ componentKey: 'kit-hero' }],
    });

    expect(result.title).toBe('Page T');
    expect(result.componentOverrides).toEqual([]);
    expect(getActiveComponentOverrides).not.toHaveBeenCalled();
  });
});

describe('resolvePageWithComponents — flag activé', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES = 'true';
  });

  it('aucun composant en argument → pas de fetch DB', async () => {
    vi.mocked(resolveSeoMetadata).mockResolvedValue(makeResolved());

    await resolvePageWithComponents({
      pageScope: 'product',
      pageTargetKey: 'le-kit',
      components: [],
    });

    expect(getActiveComponentOverrides).not.toHaveBeenCalled();
  });

  it('composant publié → title et description écrasent la page', async () => {
    vi.mocked(resolveSeoMetadata).mockResolvedValue(makeResolved({
      title: 'Page',
      description: 'Page desc',
      og: { title: 'OG Page', description: 'OG Page Desc', image: null, template: null },
    }));
    vi.mocked(getActiveComponentOverrides).mockResolvedValue(
      new Map([
        [
          'kit-hero',
          makeOverride({
            targetKey: 'kit-hero',
            title: 'Hero title',
            description: 'Hero desc',
          }),
        ],
      ]),
    );

    const result = await resolvePageWithComponents({
      pageScope: 'product',
      pageTargetKey: 'le-kit',
      components: [{ componentKey: 'kit-hero' }],
    });

    expect(result.title).toBe('Hero title');
    expect(result.description).toBe('Hero desc');
    // ogTitle absent côté composant → propage depuis component.title (fallback explicite)
    expect(result.og.title).toBe('Hero title');
    expect(result.componentOverrides).toEqual([
      { componentKey: 'kit-hero', source: 'override' },
    ]);
  });

  it('overridableFields restreint à title seul → description reste page', async () => {
    vi.mocked(resolveSeoMetadata).mockResolvedValue(makeResolved({
      title: 'Page',
      description: 'Page desc',
    }));
    vi.mocked(getActiveComponentOverrides).mockResolvedValue(
      new Map([
        [
          'kit-hero',
          makeOverride({
            targetKey: 'kit-hero',
            title: 'Hero title',
            description: 'Hero desc',
          }),
        ],
      ]),
    );

    const result = await resolvePageWithComponents({
      pageScope: 'product',
      pageTargetKey: 'le-kit',
      components: [{ componentKey: 'kit-hero', overridableFields: ['title'] }],
    });

    expect(result.title).toBe('Hero title');
    expect(result.description).toBe('Page desc'); // non écrasée
  });

  it('plusieurs composants : le dernier publié gagne sur les précédents', async () => {
    vi.mocked(resolveSeoMetadata).mockResolvedValue(makeResolved({ title: 'Page' }));
    vi.mocked(getActiveComponentOverrides).mockResolvedValue(
      new Map([
        ['c1', makeOverride({ targetKey: 'c1', title: 'C1' })],
        ['c2', makeOverride({ targetKey: 'c2', title: 'C2' })],
      ]),
    );

    const result = await resolvePageWithComponents({
      pageScope: 'product',
      pageTargetKey: 'le-kit',
      components: [{ componentKey: 'c1' }, { componentKey: 'c2' }],
    });

    expect(result.title).toBe('C2');
    expect(result.componentOverrides).toEqual([
      { componentKey: 'c1', source: 'override' },
      { componentKey: 'c2', source: 'override' },
    ]);
  });

  it('composant sans override en DB → trace source=none, page intacte', async () => {
    vi.mocked(resolveSeoMetadata).mockResolvedValue(makeResolved({ title: 'Page' }));
    vi.mocked(getActiveComponentOverrides).mockResolvedValue(new Map());

    const result = await resolvePageWithComponents({
      pageScope: 'product',
      pageTargetKey: 'le-kit',
      components: [{ componentKey: 'kit-hero' }],
    });

    expect(result.title).toBe('Page');
    expect(result.componentOverrides).toEqual([
      { componentKey: 'kit-hero', source: 'none' },
    ]);
  });

  it('og.image (mediaId) n\'est jamais écrasé par un composant', async () => {
    vi.mocked(resolveSeoMetadata).mockResolvedValue(makeResolved({
      og: { title: 'OG', description: 'D', image: 'med_page_image', template: null },
    }));
    vi.mocked(getActiveComponentOverrides).mockResolvedValue(
      new Map([
        [
          'kit-hero',
          makeOverride({
            targetKey: 'kit-hero',
            title: 'Hero',
            ogImageMediaId: 'med_component_image',
          }),
        ],
      ]),
    );

    const result = await resolvePageWithComponents({
      pageScope: 'product',
      pageTargetKey: 'le-kit',
      components: [{ componentKey: 'kit-hero' }],
    });

    // og.image (mediaId page) inchangé — invariant de phase 5.
    expect(result.og.image).toBe('med_page_image');
  });

  it('DB throw → fallback sur page seule, no crash', async () => {
    vi.mocked(resolveSeoMetadata).mockResolvedValue(makeResolved({ title: 'Page' }));
    vi.mocked(getActiveComponentOverrides).mockRejectedValue(new Error('DB down'));

    const result = await resolvePageWithComponents({
      pageScope: 'product',
      pageTargetKey: 'le-kit',
      components: [{ componentKey: 'kit-hero' }],
    });

    expect(result.title).toBe('Page');
    expect(result.componentOverrides).toEqual([]);
  });

  it('source devient « override » quand au moins un composant écrase', async () => {
    vi.mocked(resolveSeoMetadata).mockResolvedValue(makeResolved({ title: 'Page', source: 'settings' }));
    vi.mocked(getActiveComponentOverrides).mockResolvedValue(
      new Map([['kit-hero', makeOverride({ targetKey: 'kit-hero', title: 'Hero' })]]),
    );

    const result = await resolvePageWithComponents({
      pageScope: 'product',
      pageTargetKey: 'le-kit',
      components: [{ componentKey: 'kit-hero' }],
    });

    expect(result.source).toBe('override');
  });
});
