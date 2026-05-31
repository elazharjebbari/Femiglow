/**
 * Tests du linter Merchant.
 *
 * Stratégie : on part du feed canonique buildé depuis le mock kit
 * (par construction conforme), puis on injecte des défauts un par un
 * pour vérifier que chaque règle remonte la bonne issue avec le bon
 * `code`.
 *
 * Les codes (`title-too-long`, `description-html`, `image-svg`, etc.)
 * forment un contrat stable utilisé par l'UI admin pour l'affichage et
 * éventuellement par l'observabilité (compter les codes les plus
 * fréquents pour piloter les améliorations).
 */
import { describe, expect, it } from 'vitest';

import { mockKitPageContent } from '@/data/mock/kit';

import { buildKitProductFeed } from './kit-feed';
import { validateMerchantFeed } from './merchant-linter';

const product = mockKitPageContent.product;

function baselineFeed() {
  return buildKitProductFeed(product, mockKitPageContent);
}

describe('validateMerchantFeed', () => {
  it('retourne aucune erreur ni warning sur le feed canonique', () => {
    const report = validateMerchantFeed(baselineFeed());
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('signale title-too-long quand le titre dépasse 150 chars', () => {
    const feed = baselineFeed();
    feed.hero.title = 'A'.repeat(151);
    const report = validateMerchantFeed(feed);
    expect(report.errors.some((e) => e.code === 'title-too-long')).toBe(true);
  });

  it('signale title-short en warning quand le titre est < 30 chars', () => {
    const feed = baselineFeed();
    feed.hero.title = 'Court';
    const report = validateMerchantFeed(feed);
    expect(report.warnings.some((w) => w.code === 'title-short')).toBe(true);
  });

  it('signale description-too-long quand la description dépasse 5000 chars', () => {
    const feed = baselineFeed();
    feed.description = 'X'.repeat(5001);
    const report = validateMerchantFeed(feed);
    expect(report.errors.some((e) => e.code === 'description-too-long')).toBe(
      true,
    );
  });

  it('signale description-html quand la description contient des balises', () => {
    const feed = baselineFeed();
    feed.description = `${feed.description} <strong>Bonus</strong>`;
    const report = validateMerchantFeed(feed);
    expect(report.errors.some((e) => e.code === 'description-html')).toBe(true);
  });

  it('signale price-non-positive quand priceMajor = 0', () => {
    const feed = baselineFeed();
    feed.priceMajor = 0;
    const report = validateMerchantFeed(feed);
    expect(report.errors.some((e) => e.code === 'price-non-positive')).toBe(true);
  });

  it('signale promo-not-discount si promoPriceMajor ≥ priceMajor', () => {
    const feed = baselineFeed();
    feed.promoPriceMajor = feed.priceMajor + 10;
    const report = validateMerchantFeed(feed);
    expect(report.warnings.some((w) => w.code === 'promo-not-discount')).toBe(
      true,
    );
  });

  it('signale image-svg quand imageUrl pointe un .svg', () => {
    const feed = baselineFeed();
    feed.imageUrl = 'https://femiglow.ma/products/kit.svg';
    const report = validateMerchantFeed(feed);
    expect(report.errors.some((e) => e.code === 'image-svg')).toBe(true);
  });

  it('signale image-not-absolute si imageUrl est relative', () => {
    const feed = baselineFeed();
    feed.imageUrl = '/products/kit.png';
    const report = validateMerchantFeed(feed);
    expect(report.errors.some((e) => e.code === 'image-not-absolute')).toBe(
      true,
    );
  });

  it('signale image-not-raster pour une extension inconnue (ex: .webp)', () => {
    const feed = baselineFeed();
    feed.imageUrl = 'https://femiglow.ma/products/kit.webp';
    const report = validateMerchantFeed(feed);
    // Webp est en réalité supporté par Merchant, mais la liste raster
    // utilisée ici (PNG/JPG/GIF/BMP/TIFF) suit le builder local. Si on
    // élargit, mettre à jour ici + le builder en synchro.
    expect(report.errors.some((e) => e.code === 'image-not-raster')).toBe(true);
  });

  it('signale canonical-not-absolute pour une URL relative', () => {
    const feed = baselineFeed();
    feed.canonicalUrl = '/kit';
    const report = validateMerchantFeed(feed);
    expect(report.errors.some((e) => e.code === 'canonical-not-absolute')).toBe(
      true,
    );
  });

  it('signale currency-format pour « eur » en minuscules', () => {
    const feed = baselineFeed();
    feed.currency = 'eur';
    const report = validateMerchantFeed(feed);
    expect(report.errors.some((e) => e.code === 'currency-format')).toBe(true);
  });

  it('signale brand-empty pour une marque vide', () => {
    const feed = baselineFeed();
    feed.brand = '   ';
    const report = validateMerchantFeed(feed);
    expect(report.errors.some((e) => e.code === 'brand-empty')).toBe(true);
  });

  it('signale rating-too-round en warning pour une note exactement 5/5', () => {
    const feed = baselineFeed();
    feed.socialProof.rating = 5;
    const report = validateMerchantFeed(feed);
    expect(report.warnings.some((w) => w.code === 'rating-too-round')).toBe(
      true,
    );
  });

  it('signale reviews-count-round en warning pour 200 / 300 / 500 avis', () => {
    const feed = baselineFeed();
    feed.socialProof.reviewsCount = 300;
    const report = validateMerchantFeed(feed);
    expect(report.warnings.some((w) => w.code === 'reviews-count-round')).toBe(
      true,
    );
  });

  it('ne remonte PAS reviews-count-round pour 287 (chiffre précis)', () => {
    const feed = baselineFeed();
    feed.socialProof.reviewsCount = 287;
    const report = validateMerchantFeed(feed);
    expect(report.warnings.some((w) => w.code === 'reviews-count-round')).toBe(
      false,
    );
  });

  it('signale cta-microcopy-thin si la microcopy < 8 mots', () => {
    const feed = baselineFeed();
    feed.hero.ctaMicrocopy = 'Trois mots seulement.';
    const report = validateMerchantFeed(feed);
    expect(report.warnings.some((w) => w.code === 'cta-microcopy-thin')).toBe(
      true,
    );
  });

  it('aggrège plusieurs issues en une seule passe', () => {
    const feed = baselineFeed();
    feed.priceMajor = 0; // error
    feed.imageUrl = '/relative.svg'; // 3 errors (svg + not-absolute + not-raster, suivant l'implé)
    feed.socialProof.rating = 5; // warning
    const report = validateMerchantFeed(feed);
    expect(report.errors.length).toBeGreaterThanOrEqual(2);
    expect(report.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('chaque issue expose code + level + path + message non-vide', () => {
    const feed = baselineFeed();
    feed.priceMajor = -1;
    const report = validateMerchantFeed(feed);
    const issue = report.errors[0]!;
    expect(issue.code).toMatch(/^[a-z][a-z0-9-]+$/);
    expect(issue.level).toBe('error');
    expect(issue.path.length).toBeGreaterThan(0);
    expect(issue.message.length).toBeGreaterThan(10);
  });
});
