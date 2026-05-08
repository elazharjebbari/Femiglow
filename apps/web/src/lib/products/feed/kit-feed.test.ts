/**
 * Tests unitaires du builder feed produit.
 *
 * On vérifie en particulier :
 *  - les 4 étapes du rituel sont présentes dans l'ordre attendu
 *    (Préparer · Paste · Powder · Résultat) — alignement strict avec
 *    le visuel produit officiel,
 *  - les 3 promesses (origine naturelle / sans agressifs / forts) sont
 *    présentes,
 *  - le mapping prix/devise est correct (centimes → majeurs),
 *  - les principes Kolenda commentés dans le builder sont matérialisés
 *    dans le résultat (small word près du prix, microcopy dense, etc.).
 *  - la fonction est pure (mêmes entrées → mêmes sorties).
 */
import { describe, it, expect } from 'vitest';

import { mockKitPageContent } from '@/data/mock/kit';

import { buildKitProductFeed } from './kit-feed';

const product = mockKitPageContent.product;

describe('buildKitProductFeed', () => {
  it('expose les 4 étapes du rituel dans l\'ordre du visuel officiel', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    expect(feed.steps).toHaveLength(4);
    expect(feed.steps.map((s) => s.step)).toEqual([1, 2, 3, 4]);
    expect(feed.steps[0]!.title).toMatch(/préparez/i);
    expect(feed.steps[1]!.title).toMatch(/paste/i);
    expect(feed.steps[2]!.title).toMatch(/powder/i);
    expect(feed.steps[3]!.title).toMatch(/brillance|résultat/i);
  });

  it('utilise les couleurs FemiGlow (sauge/petale/champagne) sur les pastilles', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    expect(feed.steps[0]!.accent).toBe('sauge');
    expect(feed.steps[1]!.accent).toBe('sauge');
    expect(feed.steps[2]!.accent).toBe('petale');
    expect(feed.steps[3]!.accent).toBe('champagne');
  });

  it('expose les 3 promesses du visuel (leaf, drop, sparkle)', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    expect(feed.claims).toHaveLength(3);
    expect(feed.claims.map((c) => c.icon)).toEqual(['leaf', 'drop', 'sparkle']);
    expect(feed.claims[0]!.label).toMatch(/origine naturelle/i);
    expect(feed.claims[1]!.label).toMatch(/sans produits chimiques/i);
    expect(feed.claims[2]!.label).toMatch(/forts et éclatants/i);
  });

  it('matérialise les principes Kolenda dans le hero (small word + microcopy + present)', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    // Pricing #2 — small word près du prix.
    expect(feed.hero.pricePrefix.length).toBeLessThanOrEqual(20);
    expect(feed.hero.pricePrefix).toMatch(/juste|tout compris/i);
    // Pricing #11 — microcopy dense (>= 5 mots, plusieurs séparateurs).
    const microcopyTokens = feed.hero.ctaMicrocopy.split(/\s+/);
    expect(microcopyTokens.length).toBeGreaterThanOrEqual(8);
    expect(feed.hero.ctaMicrocopy).toMatch(/·|·/);
    // Copy #1 — verbe au présent dans le titre (pas de futur).
    expect(feed.hero.title).not.toMatch(/sera|va |demain/i);
  });

  it('convertit correctement les centimes en majeurs', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    // Mock kit : 32000 cents → 320 MAD
    expect(feed.priceMajor).toBe(product.priceCents / 100);
    expect(feed.currency).toBe(product.currency);
  });

  it('mappe la disponibilité produit vers in_stock / out_of_stock', () => {
    const feedIn = buildKitProductFeed({ ...product, inStock: true }, mockKitPageContent);
    expect(feedIn.availability).toBe('in_stock');
    const feedOut = buildKitProductFeed(
      { ...product, inStock: false },
      mockKitPageContent,
    );
    expect(feedOut.availability).toBe('out_of_stock');
  });

  it('expose une URL canonique absolue construite depuis NEXT_PUBLIC_SITE_URL', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    expect(feed.canonicalUrl).toMatch(/^https?:\/\//);
    expect(feed.canonicalUrl).toMatch(/\/kit$/);
  });

  it('expose une image_link absolue (préfixe avec le siteOrigin si relative)', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    expect(feed.imageUrl).toMatch(/^https?:\/\//);
  });

  it('rejette le SVG sur image_link (Merchant n\'accepte que JPG/PNG/GIF/BMP/TIFF)', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    // Le builder doit dériver une variante raster du SVG produit.
    expect(feed.imageUrl).not.toMatch(/\.svg(\?|$)/i);
    expect(feed.imageUrl).toMatch(/\.(png|jpe?g|gif|bmp|tiff)(\?|$)/i);
  });

  it('préfère une image raster directe si présente dans product.images', () => {
    const productWithJpg = {
      ...product,
      images: [
        { src: '/products/kit-principale.svg', alt: 'svg' },
        { src: '/products/kit-detail.jpg', alt: 'jpg' },
      ],
    } as typeof product;
    const feed = buildKitProductFeed(productWithJpg, mockKitPageContent);
    // Doit pointer la JPG, pas dériver une PNG depuis le SVG.
    expect(feed.imageUrl).toMatch(/kit-detail\.jpg$/);
  });

  it('dérive une variante PNG colocalisée quand seules des SVG sont disponibles', () => {
    const productSvgOnly = {
      ...product,
      images: [{ src: '/products/kit-principale.svg', alt: 'kit' }],
    } as typeof product;
    const feed = buildKitProductFeed(productSvgOnly, mockKitPageContent);
    expect(feed.imageUrl).toMatch(/\/products\/kit-principale\.png$/);
  });

  it('utilise og/kit.png en dernier recours si product.images est vide', () => {
    const productNoImages = { ...product, images: [] } as typeof product;
    const feed = buildKitProductFeed(productNoImages, mockKitPageContent);
    expect(feed.imageUrl).toMatch(/\/og\/kit\.png$/);
  });

  it('sélectionne un témoignage existant comme citation social proof', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent);
    const allQuotes = mockKitPageContent.handsTestimonials.map((t) => t.quote);
    expect(allQuotes).toContain(feed.socialProof.quote);
    // Pricing #14 — chiffres précis (note non-arrondie).
    expect(feed.socialProof.rating).toBeGreaterThan(4);
    expect(feed.socialProof.rating).toBeLessThan(5);
    expect(feed.socialProof.reviewsCount).toBeGreaterThan(100);
    // Pas un round 100/200/300/etc.
    expect(feed.socialProof.reviewsCount % 100).not.toBe(0);
  });

  it('est pure : mêmes entrées → mêmes sorties (hors brand/locale)', () => {
    const a = buildKitProductFeed(product, mockKitPageContent);
    const b = buildKitProductFeed(product, mockKitPageContent);
    expect(a).toEqual(b);
  });

  it('reflète un prix promo s\'il est défini', () => {
    const promoProduct = { ...product, promoPriceCents: product.priceCents - 5000 };
    const feed = buildKitProductFeed(promoProduct, mockKitPageContent);
    expect(feed.promoPriceMajor).toBe((product.priceCents - 5000) / 100);
  });

  it('retourne promoPriceMajor null quand promoPriceCents est null', () => {
    const noPromo = { ...product, promoPriceCents: null };
    const feed = buildKitProductFeed(noPromo, mockKitPageContent);
    expect(feed.promoPriceMajor).toBeNull();
  });

  it('utilise les stats reviews fournies en 3ᵉ argument (rating + count)', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent, {
      rating: 4.6,
      reviewsCount: 142,
    });
    expect(feed.socialProof.rating).toBe(4.6);
    expect(feed.socialProof.reviewsCount).toBe(142);
  });

  it('retombe sur DEFAULT_KIT_REVIEW_STATS quand stats=null', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent, null);
    // Cohérent avec le visuel produit officiel imprimé.
    expect(feed.socialProof.rating).toBe(4.8);
    expect(feed.socialProof.reviewsCount).toBe(287);
  });

  it('retombe sur DEFAULT_KIT_REVIEW_STATS quand stats=undefined (legacy callers)', () => {
    const feed = buildKitProductFeed(product, mockKitPageContent, undefined);
    expect(feed.socialProof.rating).toBe(4.8);
    expect(feed.socialProof.reviewsCount).toBe(287);
  });

  it('reste pur quand stats fournies (mêmes stats → mêmes sorties)', () => {
    const stats = { rating: 4.7, reviewsCount: 312 };
    const a = buildKitProductFeed(product, mockKitPageContent, stats);
    const b = buildKitProductFeed(product, mockKitPageContent, stats);
    expect(a).toEqual(b);
  });
});
