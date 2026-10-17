/**
 * Suite — `getProductReviewStats` + `_seedReview`.
 *
 * Couvre :
 *  - aucune review en base → retour `null` (caller décide du fallback),
 *  - 1+ reviews → moyenne arrondie au dixième + count exact,
 *  - filtrage strict par `productId` (les reviews d'un autre produit
 *    ne polluent pas l'agrégation),
 *  - moyenne décimale jamais tronquée à l'entier (4.7 ne devient pas 5).
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { memoryStore, resetMemoryStore } from '@/lib/db/client';

import {
  KIT_RITUAL_PRODUCT_KEY,
  _seedReview,
  getKitReviewStats,
  getProductReviewStats,
  type ProductReview,
} from './reviews';

const PRODUCT_ID = 'prod_kit_test';
const OTHER_PRODUCT_ID = 'prod_other_test';

function review(
  rating: ProductReview['rating'],
  productId = PRODUCT_ID,
  index = 0,
): ProductReview {
  return {
    id: `rev_${productId}_${index}`,
    productId,
    rating,
    createdAt: new Date('2026-04-01T12:00:00Z'),
  };
}

beforeEach(() => {
  resetMemoryStore();
});

describe('getProductReviewStats', () => {
  it('retourne null quand aucune review n\'existe pour ce produit', async () => {
    const stats = await getProductReviewStats(PRODUCT_ID);
    expect(stats).toBeNull();
  });

  it('retourne null même si d\'autres produits ont des reviews', async () => {
    _seedReview(review(5, OTHER_PRODUCT_ID, 0));
    _seedReview(review(4, OTHER_PRODUCT_ID, 1));
    const stats = await getProductReviewStats(PRODUCT_ID);
    expect(stats).toBeNull();
  });

  it('agrège correctement la moyenne (1 décimale) et le compte', async () => {
    // 5+5+4+4+5 = 23 / 5 = 4.6
    _seedReview(review(5, PRODUCT_ID, 0));
    _seedReview(review(5, PRODUCT_ID, 1));
    _seedReview(review(4, PRODUCT_ID, 2));
    _seedReview(review(4, PRODUCT_ID, 3));
    _seedReview(review(5, PRODUCT_ID, 4));
    const stats = await getProductReviewStats(PRODUCT_ID);
    expect(stats).toEqual({ rating: 4.6, reviewsCount: 5 });
  });

  it('ne pollue pas l\'agrégation avec les reviews d\'autres produits', async () => {
    _seedReview(review(5, PRODUCT_ID, 0));
    _seedReview(review(1, OTHER_PRODUCT_ID, 0)); // ne doit pas peser
    _seedReview(review(1, OTHER_PRODUCT_ID, 1));
    const stats = await getProductReviewStats(PRODUCT_ID);
    expect(stats).toEqual({ rating: 5, reviewsCount: 1 });
  });

  it('arrondit au dixième (Pricing #14 — chiffres précis)', async () => {
    // 5+5+5+4+4+4+4 = 31 / 7 = 4.4285… → arrondi 4.4
    for (let i = 0; i < 3; i++) _seedReview(review(5, PRODUCT_ID, i));
    for (let i = 3; i < 7; i++) _seedReview(review(4, PRODUCT_ID, i));
    const stats = await getProductReviewStats(PRODUCT_ID);
    expect(stats).not.toBeNull();
    expect(stats!.rating).toBe(4.4);
    expect(stats!.reviewsCount).toBe(7);
  });

  it('ne tronque pas la moyenne à l\'entier supérieur (4.6 ≠ 5)', async () => {
    _seedReview(review(5, PRODUCT_ID, 0));
    _seedReview(review(4, PRODUCT_ID, 1));
    const stats = await getProductReviewStats(PRODUCT_ID);
    expect(stats!.rating).toBe(4.5);
  });
});

function seedRitualCount(totalCount: number): void {
  memoryStore().ritualAggregate.set(KIT_RITUAL_PRODUCT_KEY, {
    productKey: KIT_RITUAL_PRODUCT_KEY,
    totalCount,
    ouiCount: totalCount,
    hesiteCount: 0,
    nonCount: 0,
    withPhotosCount: 0,
    topTags: [],
    lastPublishedAt: null,
    refreshedAt: new Date('2026-10-01T12:00:00Z'),
  });
}

describe('getKitReviewStats — source unique du pack', () => {
  it('retourne null sans aucune donnée (compteur et note masqués)', async () => {
    expect(await getKitReviewStats(PRODUCT_ID)).toBeNull();
  });

  it('compte les témoignages approuvés, sans note inventée', async () => {
    seedRitualCount(51);
    expect(await getKitReviewStats(PRODUCT_ID)).toEqual({ reviewsCount: 51, rating: null });
  });

  it('utilise la note moyenne réelle quand des avis notés existent', async () => {
    seedRitualCount(51);
    _seedReview(review(5, PRODUCT_ID, 0));
    _seedReview(review(4, PRODUCT_ID, 1));
    expect(await getKitReviewStats(PRODUCT_ID)).toEqual({ reviewsCount: 51, rating: 4.5 });
  });
});
