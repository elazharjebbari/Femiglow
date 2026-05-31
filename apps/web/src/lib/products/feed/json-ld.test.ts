/**
 * Tests unitaires de l'adapter feed → Schema.org Product enrichment.
 *
 * On vérifie que l'enrichissement produit :
 *  - `aggregateRating` (ratingValue + reviewCount) — débloque les étoiles
 *    dans les SERP Google,
 *  - `review[]` tronqué à 5 — ordre source préservé,
 *  - chaque review hérite de la note moyenne (les témoignages mains
 *    FemiGlow ne portent pas de note individuelle).
 */
import { describe, it, expect } from 'vitest';

import { mockKitPageContent } from '@/data/mock/kit';
import { productSchema } from '@/lib/seo/json-ld';

import { buildKitProductFeed } from './kit-feed';
import { feedToProductSchemaEnrichment } from './json-ld';

const product = mockKitPageContent.product;
const feed = buildKitProductFeed(product, mockKitPageContent);

describe('feedToProductSchemaEnrichment', () => {
  it('expose un aggregateRating depuis le feed.socialProof', () => {
    const enrichment = feedToProductSchemaEnrichment(
      feed,
      mockKitPageContent.handsTestimonials,
    );
    expect(enrichment.aggregateRating).toBeDefined();
    expect(enrichment.aggregateRating!.ratingValue).toBe(feed.socialProof.rating);
    expect(enrichment.aggregateRating!.reviewCount).toBe(
      feed.socialProof.reviewsCount,
    );
    expect(enrichment.aggregateRating!.bestRating).toBe(5);
    expect(enrichment.aggregateRating!.worstRating).toBe(1);
  });

  it('mappe chaque témoignage en Review', () => {
    const enrichment = feedToProductSchemaEnrichment(
      feed,
      mockKitPageContent.handsTestimonials,
    );
    expect(enrichment.reviews).toBeDefined();
    expect(enrichment.reviews!.length).toBeGreaterThan(0);
    expect(enrichment.reviews!.length).toBeLessThanOrEqual(5);
    for (const r of enrichment.reviews!) {
      expect(r.authorName).toMatch(/.+/);
      expect(r.body).toMatch(/.+/);
      expect(r.ratingValue).toBe(feed.socialProof.rating);
    }
  });

  it('tronque à 5 reviews maximum', () => {
    const many: typeof mockKitPageContent.handsTestimonials = Array.from(
      { length: 12 },
      (_, i) => ({
        ...mockKitPageContent.handsTestimonials[0]!,
        id: `t-${i}`,
        quote: `Quote ${i}`,
      }),
    );
    const enrichment = feedToProductSchemaEnrichment(feed, many);
    expect(enrichment.reviews!.length).toBe(5);
    expect(enrichment.reviews![0]!.body).toBe('Quote 0');
    expect(enrichment.reviews![4]!.body).toBe('Quote 4');
  });

  it('compose authorName "Prénom, Ville" quand city est renseignée', () => {
    const t = mockKitPageContent.handsTestimonials[0]!;
    const enrichment = feedToProductSchemaEnrichment(feed, [t]);
    if (t.city) {
      expect(enrichment.reviews![0]!.authorName).toBe(
        `${t.authorFirstName}, ${t.city}`,
      );
    } else {
      expect(enrichment.reviews![0]!.authorName).toBe(t.authorFirstName);
    }
  });

  it('expose authorName sans virgule quand city est absente', () => {
    const t = {
      ...mockKitPageContent.handsTestimonials[0]!,
      city: undefined,
    };
    const enrichment = feedToProductSchemaEnrichment(feed, [t]);
    expect(enrichment.reviews![0]!.authorName).toBe(t.authorFirstName);
    expect(enrichment.reviews![0]!.authorName).not.toContain(',');
  });

  it('retourne reviews vide si aucun témoignage', () => {
    const enrichment = feedToProductSchemaEnrichment(feed, []);
    expect(enrichment.reviews).toEqual([]);
    expect(enrichment.aggregateRating).toBeDefined();
  });
});

describe('productSchema (Schema.org Product) avec enrichissement', () => {
  it('inclut aggregateRating + review[] quand l\'enrichissement est fourni', () => {
    const enrichment = feedToProductSchemaEnrichment(
      feed,
      mockKitPageContent.handsTestimonials,
    );
    const schema = productSchema(product, '/kit', enrichment) as Record<
      string,
      unknown
    >;

    // Champs de base toujours présents.
    expect(schema['@type']).toBe('Product');
    expect(schema.name).toBe(product.name);
    expect(schema.brand).toEqual({ '@type': 'Brand', name: 'FemiGlow' });

    // Aggregate rating bien formé pour Google Rich Results.
    expect(schema.aggregateRating).toMatchObject({
      '@type': 'AggregateRating',
      ratingValue: feed.socialProof.rating.toFixed(1),
      reviewCount: feed.socialProof.reviewsCount,
      bestRating: '5.0',
      worstRating: '1.0',
    });

    // Review[] strictement typé.
    expect(Array.isArray(schema.review)).toBe(true);
    const reviews = schema.review as Array<Record<string, unknown>>;
    expect(reviews.length).toBeGreaterThan(0);
    for (const r of reviews) {
      expect(r['@type']).toBe('Review');
      expect((r.author as Record<string, unknown>)['@type']).toBe('Person');
      expect((r.reviewRating as Record<string, unknown>)['@type']).toBe('Rating');
    }
  });

  it('reste rétro-compatible sans enrichissement (pas de aggregateRating ni review)', () => {
    const schema = productSchema(product, '/kit') as Record<string, unknown>;
    expect(schema.aggregateRating).toBeUndefined();
    expect(schema.review).toBeUndefined();
    // Mais les champs de base sont là.
    expect(schema['@type']).toBe('Product');
    expect(schema.offers).toBeDefined();
  });

  it('snapshot du JSON-LD enrichi pour `/kit` (golden test)', () => {
    const enrichment = feedToProductSchemaEnrichment(
      feed,
      mockKitPageContent.handsTestimonials,
    );
    const schema = productSchema(product, '/kit', enrichment);
    expect(schema).toMatchSnapshot();
  });
});
