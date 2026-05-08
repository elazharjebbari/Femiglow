/**
 * Sérialiseur XML Google Merchant (RSS 2.0 + namespace `g:`).
 *
 * Sortie conforme à la spec officielle :
 *   https://support.google.com/merchants/answer/7052112
 *
 * On reste **délibérément minimal** sur les attributs : Google accepte
 * un sous-ensemble. Les champs présents :
 *   g:id · g:title · g:description · g:link · g:image_link
 *   g:availability · g:price · g:sale_price (si promo)
 *   g:condition · g:brand · g:identifier_exists
 *   g:product_type · g:google_product_category
 *
 * `g:identifier_exists=no` est légitime ici : on ne fournit ni GTIN
 * ni MPN (kit unique non standardisé). Google le tolère pour les
 * marques propres déclarées comme telles.
 *
 * L'XML est généré sans dépendance externe : on échappe les caractères
 * dangereux à la main (cf. `escapeXml`) et on enveloppe les champs
 * texte longs dans un CDATA pour autoriser les apostrophes Unicode et
 * les é/è sans transformer la chaîne.
 */
import type { ProductFeed } from './types';

/**
 * Échappe les 5 caractères XML interdits hors CDATA. À utiliser pour
 * les attributs et les balises courtes (id, prix, devise…).
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Strip-list des caractères ASCII de contrôle interdits par XML 1.0
 * (§2.2 — Char). On garde uniquement TAB (`\t`), LF (`\n`) et CR
 * (`\r`) ; tout le reste de la plage U+0000..U+001F rend le document
 * non-well-formed, **même à l'intérieur d'un CDATA**.
 *
 * Cas d'origine concret : copier-coller depuis Word, un PDF ou un
 * éditeur Windows qui injecte un `\x0B` (vertical tab), un `\x07`
 * (bell) ou un BOM mal placé. Sans cette passe, Google Merchant
 * rejette tout le feed avec un cryptique « parse error » et on perd
 * la fenêtre de crawl.
 *
 * On strip silencieusement plutôt que de remplacer par un placeholder
 * visible : le caractère est invisible par construction, le retirer
 * est invisible aussi pour l'utilisateur final, mais valide pour le
 * parser XML.
 *
 * Note : on préserve le BMP au-delà de U+001F et tout le supplementary
 * plane — emojis, idéogrammes, accents — car ils sont tous valides en
 * XML 1.0.
 */
export function stripInvalidXmlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/**
 * Encapsule une chaîne dans un bloc CDATA, en se protégeant contre :
 *  1. la séquence de fin `]]>` qui clôturerait prématurément le bloc,
 *  2. les caractères de contrôle ASCII interdits par XML 1.0 (cf.
 *     `stripInvalidXmlChars`).
 *
 * Exporté pour permettre des fuzz tests dédiés (cf.
 * `merchant-xml-fuzz.test.ts`) — les invariants de robustesse ne sont
 * pas couvrables uniquement via `merchantFeedXml` qui produit un XML
 * complet (bruit de signal trop élevé pour fast-check).
 */
export function cdata(value: string): string {
  const cleaned = stripInvalidXmlChars(value);
  // `]]>` → `]]]]><![CDATA[>` est la séquence d'échappement officielle
  // recommandée par le W3C pour neutraliser une fermeture prématurée
  // sans perdre de données.
  const safe = cleaned.replace(/]]>/g, ']]]]><![CDATA[>');
  return `<![CDATA[${safe}]]>`;
}

/** Formate un prix Merchant : "320.00 MAD" (toujours 2 décimales). */
export function formatMerchantPrice(major: number, currency: string): string {
  return `${major.toFixed(2)} ${currency}`;
}

/** Pretty-print un float (4.8 reste "4.8", 4.0 devient "4.0"). */
function safeNumber(n: number): string {
  return Number.isFinite(n) ? String(n) : '0';
}

/**
 * Options de sérialisation. `lastBuildDate` est injectable pour deux
 * raisons :
 *  1. Stabilité des tests (snapshot test → on injecte une date fixe).
 *  2. Cohérence du header HTTP `Last-Modified` côté route handler : on
 *     calcule une `Date` une fois, on l'utilise dans le body XML ET
 *     dans le header HTTP. Sans paramètre, deux `new Date()` séparés
 *     dériveraient de quelques millisecondes.
 */
export interface MerchantFeedXmlOptions {
  lastBuildDate?: Date;
}

/**
 * Convertit un `ProductFeed` en string XML Google Merchant.
 *
 * Le résultat inclut le prologue `<?xml ...?>` (UTF-8) — on peut le
 * servir directement avec `Content-Type: application/xml; charset=utf-8`.
 */
export function merchantFeedXml(
  feed: ProductFeed,
  options: MerchantFeedXmlOptions = {},
): string {
  const lastBuildDate = options.lastBuildDate ?? new Date();
  const items: string[] = [];

  const offer = `
    <item>
      <g:id>${escapeXml(feed.productSlug)}</g:id>
      <g:title>${cdata('Le kit FemiGlow')}</g:title>
      <g:description>${cdata(feed.description)}</g:description>
      <g:link>${escapeXml(feed.canonicalUrl)}</g:link>
      <g:image_link>${escapeXml(feed.imageUrl)}</g:image_link>
      <g:availability>${escapeXml(
        feed.availability === 'in_stock' ? 'in stock' : 'out of stock',
      )}</g:availability>
      <g:price>${escapeXml(formatMerchantPrice(feed.priceMajor, feed.currency))}</g:price>${
        feed.promoPriceMajor !== null
          ? `
      <g:sale_price>${escapeXml(formatMerchantPrice(feed.promoPriceMajor, feed.currency))}</g:sale_price>`
          : ''
      }
      <g:condition>new</g:condition>
      <g:brand>${escapeXml(feed.brand)}</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${cdata('Beauté > Soins ongles > Kit manucure')}</g:product_type>
      <g:google_product_category>2915</g:google_product_category>
      <g:custom_label_0>kit</g:custom_label_0>
      <g:custom_label_1>${escapeXml(feed.locale)}</g:custom_label_1>
    </item>`;

  items.push(offer);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>FemiGlow — Catalogue produits</title>
    <link>${escapeXml(feed.canonicalUrl.replace(/\/kit$/, ''))}</link>
    <description>${cdata(
      'Le rituel manucure FemiGlow — édité au Maroc, livré en 48 heures.',
    )}</description>
    <language>${escapeXml(feed.locale)}</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <generator>femiglow-feed/1.0 rating=${safeNumber(feed.socialProof.rating)}</generator>${items.join('')}
  </channel>
</rss>
`;
}
