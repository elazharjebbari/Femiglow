import { describe, it, expect, beforeEach, vi } from 'vitest';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import {
  getKitHeroGallery,
  getKitHeroGalleryImages,
  kitHeroGalleryTracking,
  kitHeroProductFallback,
  type GetKitHeroGalleryImagesOptions,
} from './kit-hero-gallery';
import type { ProductReviewPhoto } from '@/lib/db/types';
import type { ResolvedComponentMediaSlots } from '@/lib/components/media-variants/resolve.server';
import type { MediaSlotTrace } from '@/lib/components/media-variants/types';

// On mocke le resolver de slot — la galerie est testée en isolation des
// bindings Component-Media (qui ont leur propre suite). Ici on se concentre
// sur l'agrégation et l'ordre.
vi.mock('@/lib/components/resolver', () => ({
  resolveComponentSlot: vi.fn(async () => null),
}));

// Résolveur « médias par audience » : seul `resolveComponentMediaSlots` est
// simulé ; `delegatedTrace` / `mediaVariantTrackingValue` restent les vrais.
vi.mock('@/lib/components/media-variants/resolve.server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/components/media-variants/resolve.server')>()),
  resolveComponentMediaSlots: vi.fn(async () => ({ slots: {}, traces: {} })),
}));

import { resolveComponentSlot } from '@/lib/components/resolver';
import { resolveComponentMediaSlots } from '@/lib/components/media-variants/resolve.server';

function makeReview(overrides: Partial<ProductReviewPhoto>): ProductReviewPhoto {
  return {
    id: 'rp_test',
    productId: 'kit-femiglow',
    reviewId: null,
    src: '/reviews/test.jpg',
    alt: 'Photo cliente',
    width: 800,
    height: 1000,
    blurDataUrl: null,
    displayOrder: 0,
    status: 'published',
    reviewerInitials: null,
    reviewerCity: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper : fabrique un resolved slot minimal avec media + variants (simule le
// cas production où originalUrl=NULL mais les variants WebP/AVIF existent).
function makeResolvedSlot(slotKey: string, mediaId: string, variantUrl: string) {
  return {
    component: { id: 'comp_1', key: 'kit-hero-produit', name: 'Hero Kit', slots: [], defaultSvgFallback: null, defaultLoadingStrategy: 'eager', defaultFetchPriority: 'high' },
    slot: { id: 'slot_1', key: slotKey, label: slotKey, componentId: 'comp_1' },
    binding: { id: 'bind_1', componentId: 'comp_1', slotKey, mediaId, isActive: true, customAlt: null, loadingStrategy: null, fetchPriority: null },
    media: {
      id: mediaId,
      originalUrl: null,           // ← le cas bug : originalUrl absent en DB
      alt: 'Photo packshot kit',
      originalWidth: 1024,
      originalHeight: 1280,
      variants: [
        { id: 'v1', mediaId, format: 'webp', breakpoint: 'lg', url: variantUrl,
          width: 1024, height: 1280, bitrateKbps: null, quality: 85, sizeBytes: 62000,
          checksum: 'abc', createdAt: new Date() },
      ],
      tags: [],
    },
    animation: null,
    fallbackSvg: null,
    loadingStrategy: 'eager' as const,
    fetchPriority: 'high' as const,
    alt: 'Photo packshot kit',
  };
}

describe('getKitHeroGalleryImages', () => {
  beforeEach(() => {
    resetMemoryStore();
    vi.mocked(resolveComponentSlot).mockReset();
    vi.mocked(resolveComponentSlot).mockResolvedValue(null);
  });

  // ─── Bug 1 regression : originalUrl=NULL mais variants WebP présents ───────
  it('Bug1 : retourne le slot primary via variant URL quand originalUrl=null', async () => {
    vi.mocked(resolveComponentSlot).mockImplementation(async (_key, slot) => {
      if (slot === 'primary')
        return makeResolvedSlot('primary', 'me_4arvcdnelzb0i8ns', '/_media/media/me_4arvcdnelzb0i8ns/webp/lg.webp') as never;
      return null;
    });
    const images = await getKitHeroGalleryImages({ includeReviews: false });
    expect(images).toHaveLength(1);
    expect(images[0]?.kind).toBe('product');
    expect(images[0]?.src).toBe('/_media/media/me_4arvcdnelzb0i8ns/webp/lg.webp');
    expect(images[0]?.src).not.toContain('kit-principale.png'); // pas de SVG placeholder
  });

  it('Bug1 : retourne null pour le slot quand aucune variant ET originalUrl vide', async () => {
    vi.mocked(resolveComponentSlot).mockImplementation(async (_key, slot) => {
      if (slot === 'primary')
        return {
          ...makeResolvedSlot('primary', 'me_empty', ''),
          media: { ...makeResolvedSlot('primary', 'me_empty', '').media, variants: [], originalUrl: null },
        } as never;
      return null;
    });
    // Pas de fallback fourni → liste vide (slot ignoré silencieusement)
    const images = await getKitHeroGalleryImages({ includeReviews: false });
    expect(images).toHaveLength(0);
  });

  it("retourne une liste vide quand aucun slot n'a de binding et aucune review", async () => {
    const images = await getKitHeroGalleryImages();
    expect(images).toEqual([]);
  });

  it('inclut les photos clientes triées par display_order', async () => {
    memoryStore().productReviewPhotos.set('rp_1', makeReview({
      id: 'rp_1', src: '/reviews/a.jpg', displayOrder: 2,
    }));
    memoryStore().productReviewPhotos.set('rp_2', makeReview({
      id: 'rp_2', src: '/reviews/b.jpg', displayOrder: 1,
    }));

    const images = await getKitHeroGalleryImages();
    expect(images).toHaveLength(2);
    expect(images[0]?.src).toBe('/reviews/b.jpg');
    expect(images[1]?.src).toBe('/reviews/a.jpg');
    expect(images.every((i) => i.kind === 'review')).toBe(true);
  });

  it("ignore les photos status != 'published'", async () => {
    memoryStore().productReviewPhotos.set('rp_3', makeReview({
      id: 'rp_3', status: 'draft', src: '/reviews/draft.jpg',
    }));
    memoryStore().productReviewPhotos.set('rp_4', makeReview({
      id: 'rp_4', status: 'archived', src: '/reviews/archived.jpg',
    }));

    const images = await getKitHeroGalleryImages();
    expect(images).toHaveLength(0);
  });

  it("ne retourne pas les photos d'un autre produit", async () => {
    memoryStore().productReviewPhotos.set('rp_x', makeReview({
      id: 'rp_x', productId: 'OTHER', src: '/reviews/other.jpg',
    }));
    memoryStore().productReviewPhotos.set('rp_ok', makeReview({
      id: 'rp_ok', productId: 'kit-femiglow', src: '/reviews/ok.jpg',
    }));

    const images = await getKitHeroGalleryImages({ productId: 'kit-femiglow' });
    expect(images).toHaveLength(1);
    expect(images[0]?.src).toBe('/reviews/ok.jpg');
  });

  it('respecte includeReviews=false', async () => {
    memoryStore().productReviewPhotos.set('rp_5', makeReview({ id: 'rp_5' }));
    const images = await getKitHeroGalleryImages({ includeReviews: false });
    expect(images.filter((i) => i.kind === 'review')).toHaveLength(0);
  });

  it('respecte maxReviewPhotos', async () => {
    for (let i = 0; i < 5; i++) {
      memoryStore().productReviewPhotos.set(`rp_${i}`, makeReview({
        id: `rp_${i}`, src: `/reviews/${i}.jpg`, displayOrder: i,
      }));
    }
    const images = await getKitHeroGalleryImages({ maxReviewPhotos: 2, maxTotal: 10 });
    expect(images).toHaveLength(2);
  });

  it('respecte maxTotal (cap global)', async () => {
    for (let i = 0; i < 8; i++) {
      memoryStore().productReviewPhotos.set(`rp_${i}`, makeReview({
        id: `rp_${i}`, src: `/reviews/${i}.jpg`, displayOrder: i,
      }));
    }
    const images = await getKitHeroGalleryImages({ maxReviewPhotos: 20, maxTotal: 3 });
    expect(images).toHaveLength(3);
  });

  it('construit une caption "I. R. · Rabat" quand initiales+ville fournies', async () => {
    memoryStore().productReviewPhotos.set('rp_cap', makeReview({
      id: 'rp_cap',
      reviewerInitials: 'I. R.',
      reviewerCity: 'Rabat',
    }));
    const images = await getKitHeroGalleryImages();
    expect(images[0]?.caption).toBe('I. R. · Rabat');
  });

  it("retourne caption undefined quand aucune metadata d'attribution", async () => {
    memoryStore().productReviewPhotos.set('rp_nocap', makeReview({
      id: 'rp_nocap',
      reviewerInitials: null,
      reviewerCity: null,
    }));
    const images = await getKitHeroGalleryImages();
    expect(images[0]?.caption).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// getKitHeroGallery — images par audience (PR 4)
// ─────────────────────────────────────────────────────────────────────────

const PRODUCT_FALLBACK = {
  src: '/products/kit-principale.png',
  alt: 'Pack FemiGlow',
  width: 1200,
  height: 1500,
};

function setTrace(slot: string, overrides: Partial<MediaSlotTrace> = {}): MediaSlotTrace {
  return {
    slot,
    level: 1,
    setId: `set-${slot}`,
    variantDim: 'angle',
    variantKey: 'e',
    locale: 'ar',
    version: 3,
    ...overrides,
  };
}

function mockSets(value: ResolvedComponentMediaSlots) {
  vi.mocked(resolveComponentMediaSlots).mockResolvedValue(value);
}

/** Liaisons legacy : primary + context_1 + context_2. */
function mockLegacyBindings() {
  vi.mocked(resolveComponentSlot).mockImplementation(async (_key, slot) => {
    if (slot === 'primary') return makeResolvedSlot('primary', 'me_primary', '/_media/primary.webp') as never;
    if (slot === 'context_1') return makeResolvedSlot('context_1', 'me_ctx1', '/_media/ctx1.webp') as never;
    if (slot === 'context_2') return makeResolvedSlot('context_2', 'me_ctx2', '/_media/ctx2.webp') as never;
    return null;
  });
}

function seedReviews(count: number) {
  for (let i = 0; i < count; i++) {
    memoryStore().productReviewPhotos.set(
      `rp_${i}`,
      makeReview({ id: `rp_${i}`, src: `/reviews/${i}.jpg`, displayOrder: i }),
    );
  }
}

const BASE = { locale: 'ar' as const, angle: 'e' as const, productFallback: PRODUCT_FALLBACK };

describe('getKitHeroGallery — drapeau coupé (galerie historique à l’identique)', () => {
  beforeEach(() => {
    resetMemoryStore();
    vi.mocked(resolveComponentSlot).mockReset();
    vi.mocked(resolveComponentSlot).mockResolvedValue(null);
    vi.mocked(resolveComponentMediaSlots).mockClear();
  });

  it('images strictement égales à getKitHeroGalleryImages (liaisons + avis)', async () => {
    mockLegacyBindings();
    seedReviews(3);
    const opts: GetKitHeroGalleryImagesOptions = { productFallback: PRODUCT_FALLBACK, maxTotal: 7 };

    const legacy = await getKitHeroGalleryImages(opts);
    const gallery = await getKitHeroGallery({ ...opts, ...BASE, flagEnabled: false });

    expect(gallery.images).toStrictEqual(legacy);
    expect(gallery.variantsEnabled).toBe(false);
    expect(gallery.trackingValue).toBe('legacy');
    expect(gallery.level).toBe(7);
    // Les ensembles ne sont même pas lus.
    expect(resolveComponentMediaSlots).not.toHaveBeenCalled();
    expect(kitHeroGalleryTracking(gallery)).toBeNull();
  });

  it('forme exacte de la galerie historique (aucun champ ajouté)', async () => {
    mockLegacyBindings();
    seedReviews(1);
    const gallery = await getKitHeroGallery({ ...BASE, flagEnabled: false });
    expect(gallery.images).toStrictEqual([
      {
        id: 'slot-primary-me_primary',
        src: '/_media/primary.webp',
        alt: 'Photo packshot kit',
        width: 1024,
        height: 1280,
        blurDataURL: undefined,
        kind: 'product',
      },
      {
        id: 'slot-context_1-me_ctx1',
        src: '/_media/ctx1.webp',
        alt: 'Photo packshot kit',
        width: 1024,
        height: 1280,
        blurDataURL: undefined,
        kind: 'context',
      },
      {
        id: 'slot-context_2-me_ctx2',
        src: '/_media/ctx2.webp',
        alt: 'Photo packshot kit',
        width: 1024,
        height: 1280,
        blurDataURL: undefined,
        kind: 'context',
      },
      {
        id: 'review-rp_0',
        src: '/reviews/0.jpg',
        alt: 'Photo cliente',
        width: 800,
        height: 1000,
        blurDataURL: undefined,
        kind: 'review',
        caption: undefined,
      },
    ]);
  });

  it('sans liaison : image produit de repli, valeur « product » (niveau 8)', async () => {
    const opts = { productFallback: PRODUCT_FALLBACK };
    const gallery = await getKitHeroGallery({ ...opts, ...BASE, flagEnabled: false });
    expect(gallery.images).toStrictEqual(await getKitHeroGalleryImages(opts));
    expect(gallery.images[0]?.id).toBe('product-fallback');
    expect(gallery.trackingValue).toBe('product');
    expect(gallery.level).toBe(8);
  });

  it('ignore `draft` drapeau coupé', async () => {
    await getKitHeroGallery({ ...BASE, flagEnabled: false, draft: true });
    expect(resolveComponentMediaSlots).not.toHaveBeenCalled();
  });
});

describe('getKitHeroGallery — drapeau actif', () => {
  beforeEach(() => {
    resetMemoryStore();
    vi.mocked(resolveComponentSlot).mockReset();
    vi.mocked(resolveComponentSlot).mockResolvedValue(null);
    vi.mocked(resolveComponentMediaSlots).mockReset();
    vi.mocked(resolveComponentMediaSlots).mockResolvedValue({ slots: {}, traces: {} });
  });

  it('ensemble angle × langue : image principale art-dirigée, trace niveau 1', async () => {
    mockLegacyBindings();
    mockSets({
      slots: {
        primary: [
          {
            id: 'mset-set-primary-0',
            src: '/_media/e-ar-desktop.webp',
            width: 1200,
            height: 1500,
            blurDataURL: 'data:image/webp;base64,AAA',
            alt: 'صورة',
            focalX: 50,
            focalY: 30,
            mobile: {
              src: '/_media/e-ar-mobile.webp',
              width: 1200,
              height: 1600,
              blurDataURL: 'data:image/webp;base64,MOBILE',
            },
          },
        ],
        secondary: null,
      },
      traces: { primary: setTrace('primary'), secondary: setTrace('secondary', { level: 7, setId: null, variantDim: null, variantKey: null, locale: null, version: null }) },
    });

    const gallery = await getKitHeroGallery({ ...BASE, flagEnabled: true, draft: true, fallbackAlt: 'باك' });

    expect(resolveComponentMediaSlots).toHaveBeenCalledWith(
      'kit-hero-produit',
      { locale: 'ar', variants: { angle: 'e' } },
      { draft: true, fallbackAlt: 'باك' },
    );
    expect(gallery.images[0]).toStrictEqual({
      id: 'mset-set-primary-0',
      src: '/_media/e-ar-desktop.webp',
      alt: 'صورة',
      width: 1200,
      height: 1500,
      kind: 'product',
      blurDataURL: 'data:image/webp;base64,AAA',
      objectPosition: '50% 30%',
      mobile: { src: '/_media/e-ar-mobile.webp', width: 1200, height: 1600 },
    });
    // Flou mobile non repris (un <source> n'a pas de placeholder).
    expect(gallery.images[0]?.mobile).not.toHaveProperty('blurDataURL');
    expect(gallery.trace.primary.level).toBe(1);
    expect(gallery.trackingValue).toBe('angle-e.ar.v3');
    expect(gallery.level).toBe(1);
    expect(gallery.variantsEnabled).toBe(true);
    // Résolue depuis les brouillons (aperçu admin) : jamais exposée au tracking.
    expect(gallery.draft).toBe(true);
    expect(kitHeroGalleryTracking(gallery)).toBeNull();
    expect(kitHeroGalleryTracking({ ...gallery, draft: false })).toEqual({
      variant: 'angle-e.ar.v3',
      level: 1,
    });
    // La liaison legacy `primary` n'est pas consultée.
    expect(vi.mocked(resolveComponentSlot).mock.calls.map((c) => c[1])).not.toContain('primary');
    // Secondaires : repli legacy context_1/2 (avec identifiant du média).
    expect(gallery.images.slice(1).map((i) => i.src)).toEqual(['/_media/ctx1.webp', '/_media/ctx2.webp']);
    expect(gallery.images[1]?.mediaId).toBe('me_ctx1');
    expect(gallery.trace.secondary.level).toBe(7);
  });

  it('cadrage nommé repris quand il n’y a pas de point focal', async () => {
    mockSets({
      slots: {
        primary: [{ id: 'm', src: '/d.webp', width: 1, height: 1, alt: '', objectPosition: 'top' }],
        secondary: null,
      },
      traces: { primary: setTrace('primary', { variantDim: 'default', variantKey: '*', locale: '*', version: 1, level: 5 }) },
    });
    const gallery = await getKitHeroGallery({ ...BASE, flagEnabled: true });
    expect(gallery.images[0]?.objectPosition).toBe('top');
    expect(gallery.images[0]).not.toHaveProperty('mobile');
    expect(gallery.trackingValue).toBe('default.any.v1');
    expect(gallery.level).toBe(5);
  });

  it('aucun ensemble : liaison legacy `primary` (niveau 7, « legacy »)', async () => {
    mockLegacyBindings();
    const gallery = await getKitHeroGallery({ ...BASE, flagEnabled: true });
    expect(gallery.images[0]?.src).toBe('/_media/primary.webp');
    expect(gallery.images[0]?.mediaId).toBe('me_primary');
    expect(gallery.trackingValue).toBe('legacy');
    expect(gallery.level).toBe(7);
    expect(kitHeroGalleryTracking(gallery)).toEqual({ variant: 'legacy', level: 7 });
  });

  it('ni ensemble ni liaison : image produit (niveau 8, « product »)', async () => {
    const gallery = await getKitHeroGallery({ ...BASE, flagEnabled: true });
    expect(gallery.images).toHaveLength(1);
    expect(gallery.images[0]?.id).toBe('product-fallback');
    expect(gallery.trackingValue).toBe('product');
    expect(gallery.level).toBe(8);
    expect(gallery.draft).toBe(false);
  });

  it('flou `media.blur_data_url` repris sur le repli legacy', async () => {
    vi.mocked(resolveComponentSlot).mockImplementation(async (_key, slot) => {
      if (slot !== 'primary') return null;
      const r = makeResolvedSlot('primary', 'me_p', '/_media/p.webp');
      return { ...r, media: { ...r.media, blurDataUrl: 'data:image/webp;base64,BBB' } } as never;
    });
    const gallery = await getKitHeroGallery({ ...BASE, flagEnabled: true });
    expect(gallery.images[0]?.blurDataURL).toBe('data:image/webp;base64,BBB');
  });

  it('liste `secondary` de l’ensemble : remplace context_1/2 en entier', async () => {
    mockLegacyBindings();
    mockSets({
      slots: {
        primary: null,
        secondary: [
          { id: 's0', src: '/_media/s0.webp', width: 1200, height: 1500, alt: 'a' },
          { id: 's1', src: '/_media/s1.webp', width: 1200, height: 1500, alt: 'b' },
          { id: 's2', src: '/_media/s2.webp', width: 1200, height: 1500, alt: 'c' },
        ],
      },
      traces: { primary: setTrace('primary', { level: 7 }), secondary: setTrace('secondary') },
    });
    const gallery = await getKitHeroGallery({ ...BASE, flagEnabled: true });
    expect(gallery.images.map((i) => [i.src, i.kind])).toEqual([
      ['/_media/primary.webp', 'product'],
      ['/_media/s0.webp', 'context'],
      ['/_media/s1.webp', 'context'],
      ['/_media/s2.webp', 'context'],
    ]);
    expect(vi.mocked(resolveComponentSlot).mock.calls.map((c) => c[1])).not.toContain('context_1');
    expect(gallery.trace.secondary.level).toBe(1);
    // La valeur de tracking suit l'image principale (legacy ici).
    expect(gallery.trackingValue).toBe('legacy');
  });

  it('photos clientes ajoutées en queue, total plafonné à maxTotal', async () => {
    seedReviews(6);
    mockSets({
      slots: {
        primary: [{ id: 'p', src: '/_media/p.webp', width: 1, height: 1, alt: '' }],
        secondary: [
          { id: 's0', src: '/_media/s0.webp', width: 1, height: 1, alt: '' },
          { id: 's1', src: '/_media/s1.webp', width: 1, height: 1, alt: '' },
        ],
      },
      traces: { primary: setTrace('primary'), secondary: setTrace('secondary') },
    });
    const gallery = await getKitHeroGallery({ ...BASE, flagEnabled: true, maxTotal: 5 });
    expect(gallery.images.map((i) => i.kind)).toEqual(['product', 'context', 'context', 'review', 'review']);
    expect(gallery.images[3]?.src).toBe('/reviews/0.jpg');

    const all = await getKitHeroGallery({ ...BASE, flagEnabled: true });
    expect(all.images).toHaveLength(7);
  });

  it('includeReviews=false respecté', async () => {
    seedReviews(2);
    const gallery = await getKitHeroGallery({ ...BASE, flagEnabled: true, includeReviews: false });
    expect(gallery.images.some((i) => i.kind === 'review')).toBe(false);
  });

  it('erreur de lecture des ensembles : repli legacy sans faire échouer la page', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLegacyBindings();
    vi.mocked(resolveComponentMediaSlots).mockRejectedValue(new Error('db down'));
    const gallery = await getKitHeroGallery({ ...BASE, flagEnabled: true });
    expect(gallery.images[0]?.src).toBe('/_media/primary.webp');
    expect(gallery.trackingValue).toBe('legacy');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('kitHeroProductFallback', () => {
  it('reprend product.images[0] ; undefined sans image', () => {
    expect(kitHeroProductFallback(undefined)).toBeUndefined();
    expect(kitHeroProductFallback({ ...PRODUCT_FALLBACK, blurDataURL: 'x' })).toEqual({
      ...PRODUCT_FALLBACK,
      blurDataURL: 'x',
    });
  });
});
