/**
 * Tests du schéma Zod runtime du feed produit.
 *
 * Couvre :
 *  - validation passe sur le feed canonique (mock kit) ;
 *  - cas dégradés (champ manquant, mauvais type, contrainte métier
 *    violée) sont catchés en mode `strict` ;
 *  - mode non-strict (prod) n'explose pas mais log un warning.
 *
 * On vérifie aussi les contraintes Kolenda matérialisées dans le
 * schéma (microcopy ≥ 8 mots, pricePrefix ≤ 20 chars, exactement 4
 * steps, exactement 3 claims, image_link raster).
 */
import { describe, expect, it, vi } from 'vitest';

import { mockKitPageContent } from '@/data/mock/kit';

import { buildKitProductFeed } from './kit-feed';
import { assertValidProductFeed, productFeedSchema } from './schema';

const product = mockKitPageContent.product;

describe('productFeedSchema', () => {
  it('valide le feed canonique buildé depuis le mock kit', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const result = productFeedSchema.safeParse(feed);
    expect(result.success).toBe(true);
  });

  it('rejette un feed sans steps', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const broken = { ...feed, steps: [] };
    const result = productFeedSchema.safeParse(broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('steps'))).toBe(true);
    }
  });

  it('rejette un feed avec 3 steps au lieu de 4', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const broken = { ...feed, steps: feed.steps.slice(0, 3) };
    expect(productFeedSchema.safeParse(broken).success).toBe(false);
  });

  it('rejette un feed avec 5 steps au lieu de 4', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const broken = { ...feed, steps: [...feed.steps, feed.steps[0]!] };
    expect(productFeedSchema.safeParse(broken).success).toBe(false);
  });

  it('rejette un feed avec moins de 3 claims', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const broken = { ...feed, claims: feed.claims.slice(0, 2) };
    expect(productFeedSchema.safeParse(broken).success).toBe(false);
  });

  it('rejette une image_link SVG (Merchant n\'accepte que raster)', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const broken = { ...feed, imageUrl: 'https://femiglow.ma/products/kit.svg' };
    const result = productFeedSchema.safeParse(broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes('imageUrl')),
      ).toBe(true);
    }
  });

  it('rejette un microcopy < 8 mots (Pricing #11 — densify)', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const broken = {
      ...feed,
      hero: { ...feed.hero, ctaMicrocopy: 'Quatre mots seulement, dommage.' },
    };
    const result = productFeedSchema.safeParse(broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.path.join('.').includes('hero.ctaMicrocopy'),
        ),
      ).toBe(true);
    }
  });

  it('rejette un pricePrefix > 20 chars (Pricing #2 — small word)', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const broken = {
      ...feed,
      hero: {
        ...feed.hero,
        pricePrefix: 'Un préfixe vraiment trop long pour le pattern',
      },
    };
    expect(productFeedSchema.safeParse(broken).success).toBe(false);
  });

  it('rejette un priceMajor négatif', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const broken = { ...feed, priceMajor: -10 };
    expect(productFeedSchema.safeParse(broken).success).toBe(false);
  });

  it('accepte promoPriceMajor à null mais rejette une string', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const ok = { ...feed, promoPriceMajor: null };
    expect(productFeedSchema.safeParse(ok).success).toBe(true);
    const broken = { ...feed, promoPriceMajor: 'free' };
    expect(productFeedSchema.safeParse(broken).success).toBe(false);
  });

  it('rejette un rating > 5', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const broken = {
      ...feed,
      socialProof: { ...feed.socialProof, rating: 5.5 },
    };
    expect(productFeedSchema.safeParse(broken).success).toBe(false);
  });

  it('rejette une locale mal formatée', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const broken = { ...feed, locale: 'french' };
    expect(productFeedSchema.safeParse(broken).success).toBe(false);
  });
});

describe('assertValidProductFeed', () => {
  it('en mode strict (dev) : throw avec message lisible incluant le chemin du champ', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const broken = { ...feed, steps: [] };
    expect(() => assertValidProductFeed(broken, { strict: true })).toThrow(
      /Invalid ProductFeed/,
    );
    expect(() => assertValidProductFeed(broken, { strict: true })).toThrow(/steps/);
  });

  it('en mode non-strict (prod) : ne throw pas, log un warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const feed = buildKitProductFeed(product, mockKitPageContent);
      const broken = { ...feed, steps: [] };
      expect(() => assertValidProductFeed(broken, { strict: false })).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        '[product-feed]',
        expect.stringContaining('Invalid ProductFeed'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('passe silencieusement sur un feed valide (strict ou non)', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    expect(() => assertValidProductFeed(feed, { strict: true })).not.toThrow();
    expect(() => assertValidProductFeed(feed, { strict: false })).not.toThrow();
  });
});
