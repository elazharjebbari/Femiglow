/**
 * Tests unitaires du sérialiseur Google Merchant XML.
 *
 * Couvre :
 *  - prologue XML + namespace `g:` corrects,
 *  - tous les champs requis par la spec (id, title, description, link,
 *    image_link, availability, price, condition, brand,
 *    identifier_exists, product_type, google_product_category),
 *  - prix promo conditionnel,
 *  - échappement des caractères XML interdits,
 *  - protection CDATA contre la séquence `]]>` (ré-injection),
 *  - format de prix « 289.00 MAD » strict (toujours 2 décimales).
 */
import { describe, it, expect } from 'vitest';

import { mockKitPageContent } from '@/data/mock/kit';

import { buildKitProductFeed } from './kit-feed';
import { merchantFeedXml, escapeXml, formatMerchantPrice } from './merchant-xml';

const product = mockKitPageContent.product;

function buildXml(overrides: Partial<typeof product> = {}): string {
  const merged = { ...product, ...overrides } as typeof product;
  const feed = buildKitProductFeed(merged, mockKitPageContent);
  return merchantFeedXml(feed);
}

describe('escapeXml', () => {
  it('échappe les 5 caractères XML interdits', () => {
    expect(escapeXml('<a href="x">Y & Z\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;Y &amp; Z&apos;&lt;/a&gt;',
    );
  });
});

describe('formatMerchantPrice', () => {
  it('formate avec 2 décimales et la devise', () => {
    expect(formatMerchantPrice(320, 'MAD')).toBe('320.00 MAD');
    expect(formatMerchantPrice(149.5, 'EUR')).toBe('149.50 EUR');
    expect(formatMerchantPrice(0.99, 'USD')).toBe('0.99 USD');
  });
});

describe('merchantFeedXml', () => {
  it('produit un prologue XML UTF-8 + namespace g:', () => {
    const xml = buildXml();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain('version="2.0"');
  });

  it('contient tous les champs Merchant requis pour le kit', () => {
    const xml = buildXml();
    expect(xml).toContain(`<g:id>${product.slug}</g:id>`);
    expect(xml).toContain('<g:title>');
    expect(xml).toContain('<g:description>');
    expect(xml).toContain('<g:link>');
    expect(xml).toContain('<g:image_link>');
    expect(xml).toContain('<g:availability>in stock</g:availability>');
    expect(xml).toContain('<g:price>');
    expect(xml).toContain('<g:condition>new</g:condition>');
    expect(xml).toContain('<g:brand>FemiGlow</g:brand>');
    expect(xml).toContain('<g:identifier_exists>no</g:identifier_exists>');
    expect(xml).toContain('<g:product_type>');
    expect(xml).toContain('<g:google_product_category>2915</g:google_product_category>');
    expect(xml).toContain('<g:custom_label_0>kit</g:custom_label_0>');
    expect(xml).toContain('<g:custom_label_1>fr-MA</g:custom_label_1>');
  });

  it('utilise CDATA pour les champs textuels longs', () => {
    const xml = buildXml();
    // Title et description doivent être en CDATA (autorise apostrophes
    // unicode et accents sans transformation).
    const titleMatch = xml.match(/<g:title>(.+?)<\/g:title>/);
    expect(titleMatch?.[1]).toMatch(/^<!\[CDATA\[/);
    const descMatch = xml.match(/<g:description>([\s\S]+?)<\/g:description>/);
    expect(descMatch?.[1]).toMatch(/^<!\[CDATA\[/);
  });

  it('formate le prix en "{majeur}.00 {currency}" sur le kit mock (289 MAD)', () => {
    const xml = buildXml();
    expect(xml).toMatch(/<g:price>289\.00 MAD<\/g:price>/);
  });

  it('inclut g:sale_price quand promoPriceCents est défini', () => {
    const xml = buildXml({ promoPriceCents: 28000 });
    expect(xml).toContain('<g:sale_price>280.00 MAD</g:sale_price>');
    // Le prix barré reste à 289 (référence Pack FemiGlow, révision 2026-05-22).
    expect(xml).toContain('<g:price>289.00 MAD</g:price>');
  });

  it('omet g:sale_price quand pas de promo', () => {
    const xml = buildXml({ promoPriceCents: null });
    expect(xml).not.toContain('<g:sale_price>');
  });

  it('expose la disponibilité out of stock quand inStock=false', () => {
    const xml = buildXml({ inStock: false });
    expect(xml).toContain('<g:availability>out of stock</g:availability>');
  });

  it('inclut un lastBuildDate au format RFC 2822', () => {
    const xml = buildXml();
    const m = xml.match(/<lastBuildDate>(.+?)<\/lastBuildDate>/);
    expect(m).not.toBeNull();
    // RFC 2822 : « Tue, 07 May 2026 12:34:56 GMT ».
    expect(m![1]).toMatch(
      /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/,
    );
  });

  it('protège CDATA contre la séquence ]]>', () => {
    // On simule une description piégée (cas extrême).
    const trapProduct = {
      ...product,
      description: 'before ]]> after',
    } as typeof product;
    const feed = buildKitProductFeed(trapProduct, mockKitPageContent);
    const xml = merchantFeedXml(feed);
    // La séquence brute ne doit pas apparaître dans le payload final
    // dans une zone qui clôt CDATA prématurément. La technique
    // recommandée par le W3C insère « ]]]]><![CDATA[> ».
    expect(xml).toContain(']]]]><![CDATA[>');
    expect(xml).not.toMatch(/before \]\]> after/);
  });

  it('échappe les caractères XML dans les balises non-CDATA (id, link)', () => {
    // On force une URL contenant un & (pas de cas réel, mais c'est
    // exactement ce qui doit être échappé pour un parser strict).
    process.env.NEXT_PUBLIC_SITE_URL = 'https://femi&glow.test';
    try {
      const feed = buildKitProductFeed(product, mockKitPageContent);
      const xml = merchantFeedXml(feed);
      expect(xml).toContain('femi&amp;glow.test');
      expect(xml).not.toMatch(/<g:link>https:\/\/femi&glow/);
    } finally {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  });

  /**
   * Snapshot golden — bloque toute régression accidentelle du format XML.
   *
   * On masque le `<lastBuildDate>` (RFC 2822, non-déterministe) avec un
   * placeholder pour que le snapshot reste stable. Toute autre divergence
   * (ordre des balises, nouvelles balises, échappement, CDATA…) sera
   * captée et requerra un `bun run test -u` explicite.
   */
  it('snapshot XML complet pour le kit mock (golden)', () => {
    const xml = buildXml().replace(
      /<lastBuildDate>[^<]+<\/lastBuildDate>/,
      '<lastBuildDate>__DATE__</lastBuildDate>',
    );
    expect(xml).toMatchSnapshot();
  });
});
