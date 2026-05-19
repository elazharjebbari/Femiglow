import { describe, it, expect, beforeEach, vi } from 'vitest';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import { getKitHeroGalleryImages } from './kit-hero-gallery';
import type { ProductReviewPhoto } from '@/lib/db/types';

// On mocke le resolver de slot — la galerie est testée en isolation des
// bindings Component-Media (qui ont leur propre suite). Ici on se concentre
// sur l'agrégation et l'ordre.
vi.mock('@/lib/components/resolver', () => ({
  resolveComponentSlot: vi.fn(async () => null),
}));

import { resolveComponentSlot } from '@/lib/components/resolver';

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

describe('getKitHeroGalleryImages', () => {
  beforeEach(() => {
    resetMemoryStore();
    vi.mocked(resolveComponentSlot).mockReset();
    vi.mocked(resolveComponentSlot).mockResolvedValue(null);
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
