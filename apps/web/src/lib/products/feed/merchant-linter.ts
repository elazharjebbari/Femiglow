/**
 * Linter Google Merchant pour `ProductFeed`.
 *
 * Pourquoi un linter dédié alors que Zod valide déjà la forme (cf.
 * `schema.ts`) ?
 *  - Zod valide la **structure** (tous les champs présents, types
 *    corrects, contraintes de longueur générales). C'est un filet
 *    fail-fast pour le builder.
 *  - Le linter audite la **conformité Merchant** : longueurs
 *    recommandées par Google Shopping, absence de HTML dans la
 *    description, chiffres précis (Kolenda Pricing #14), bonnes
 *    pratiques SEO (title 30+ chars, description 80+ chars).
 *  - Distinguer **errors** (rejet ingestion) vs **warnings**
 *    (accepté mais suboptimal) permet à l'admin de prioriser sans
 *    bloquer une publication imparfaite.
 *
 * Le linter ne **modifie pas** le feed — il rapporte. C'est un outil
 * de revue éditoriale rendu dans `/admin/products/feed`.
 *
 * Spec Google Merchant : https://support.google.com/merchants/answer/7052112
 */
import type { ProductFeed } from './types';

/** Une remontée du linter (erreur ou warning). */
export interface MerchantLintIssue {
  /** Code court stable (utilisable pour ignore-list, telemetry). */
  code: string;
  /** Niveau : error = bloque ingestion, warning = recommandation. */
  level: 'error' | 'warning';
  /** Chemin pointant le champ fautif (ex: "hero.ctaMicrocopy"). */
  path: string;
  /** Message lisible en français. */
  message: string;
}

export interface MerchantLintReport {
  errors: MerchantLintIssue[];
  warnings: MerchantLintIssue[];
}

/**
 * Limites Merchant officielles. On les centralise pour éviter les
 * magic numbers répartis dans le linter et faciliter une mise à jour
 * en cas d'évolution de la spec.
 *
 * Sources (last reviewed 2026-Q1) :
 *  - title : max 150 (Google Merchant), recommandé 30-70.
 *  - description : max 5000, recommandé 100-1000.
 *  - price : > 0 strict (Merchant rejette 0 et négatifs).
 */
const LIMITS = {
  TITLE_MAX: 150,
  TITLE_MIN_RECOMMENDED: 30,
  DESCRIPTION_MAX: 5000,
  DESCRIPTION_MIN_RECOMMENDED: 80,
  // Pricing #11 — densify : 8 mots minimum dans la microcopy CTA.
  CTA_MICROCOPY_MIN_WORDS: 8,
} as const;

/**
 * Audit complet du feed Merchant. Retourne `{ errors: [], warnings: [] }`
 * pour un feed parfaitement conforme.
 *
 * Pure : pas d'I/O, pas d'effet de bord — testable directement.
 */
export function validateMerchantFeed(feed: ProductFeed): MerchantLintReport {
  const errors: MerchantLintIssue[] = [];
  const warnings: MerchantLintIssue[] = [];

  // -------- Title --------
  // Le title Merchant n'est pas exposé séparément — on utilise
  // `hero.title` qui est ce que voit le visiteur sur /kit. Si le
  // builder Merchant force un autre title, ajuster ici.
  if (feed.hero.title.length > LIMITS.TITLE_MAX) {
    errors.push({
      code: 'title-too-long',
      level: 'error',
      path: 'hero.title',
      message: `Le titre fait ${feed.hero.title.length} chars (max Merchant : ${LIMITS.TITLE_MAX}).`,
    });
  }
  if (feed.hero.title.length < LIMITS.TITLE_MIN_RECOMMENDED) {
    warnings.push({
      code: 'title-short',
      level: 'warning',
      path: 'hero.title',
      message: `Titre court (${feed.hero.title.length} chars). Google recommande ≥ ${LIMITS.TITLE_MIN_RECOMMENDED} pour le SEO Shopping.`,
    });
  }

  // -------- Description --------
  if (feed.description.length > LIMITS.DESCRIPTION_MAX) {
    errors.push({
      code: 'description-too-long',
      level: 'error',
      path: 'description',
      message: `Description ${feed.description.length} chars > limite Merchant ${LIMITS.DESCRIPTION_MAX}.`,
    });
  }
  if (feed.description.length < LIMITS.DESCRIPTION_MIN_RECOMMENDED) {
    warnings.push({
      code: 'description-short',
      level: 'warning',
      path: 'description',
      message: `Description courte (${feed.description.length} chars). Recommandé ≥ ${LIMITS.DESCRIPTION_MIN_RECOMMENDED} pour le SEO.`,
    });
  }
  // Merchant interdit explicitement les balises HTML dans la
  // description. On détecte les patterns < ... > simples.
  if (/<[a-z!\/][^>]*>/i.test(feed.description)) {
    errors.push({
      code: 'description-html',
      level: 'error',
      path: 'description',
      message:
        'La description contient des balises HTML. Merchant exige du texte brut (les balises sont stripées ou le feed est rejeté).',
    });
  }

  // -------- Price --------
  if (feed.priceMajor <= 0) {
    errors.push({
      code: 'price-non-positive',
      level: 'error',
      path: 'priceMajor',
      message: `Prix ${feed.priceMajor} ${feed.currency} — Merchant exige un prix > 0.`,
    });
  }
  if (feed.promoPriceMajor !== null) {
    if (feed.promoPriceMajor >= feed.priceMajor) {
      warnings.push({
        code: 'promo-not-discount',
        level: 'warning',
        path: 'promoPriceMajor',
        message: `Le prix promo (${feed.promoPriceMajor}) n'est pas inférieur au prix standard (${feed.priceMajor}). Merchant attend sale_price < price.`,
      });
    }
    if (feed.promoPriceMajor <= 0) {
      errors.push({
        code: 'promo-non-positive',
        level: 'error',
        path: 'promoPriceMajor',
        message: `Prix promo ${feed.promoPriceMajor} ${feed.currency} — doit être > 0 si présent.`,
      });
    }
  }

  // -------- Image --------
  // Re-vérification au-delà de Zod : on tolère ici un message plus
  // explicite (« migrer vers PNG ») qu'un échec parse Zod générique.
  if (!/^https?:\/\//i.test(feed.imageUrl)) {
    errors.push({
      code: 'image-not-absolute',
      level: 'error',
      path: 'imageUrl',
      message: `image_link doit être une URL absolue (http/https). Reçu : « ${feed.imageUrl} ».`,
    });
  }
  if (/\.svg(\?|$)/i.test(feed.imageUrl)) {
    errors.push({
      code: 'image-svg',
      level: 'error',
      path: 'imageUrl',
      message:
        'image_link en .svg — Merchant rejette le SVG (cf. https://support.google.com/merchants/answer/6324350). Utilisez PNG / JPG / GIF / BMP / TIFF.',
    });
  }
  if (!/\.(png|jpe?g|gif|bmp|tiff)(\?|$)/i.test(feed.imageUrl)) {
    errors.push({
      code: 'image-not-raster',
      level: 'error',
      path: 'imageUrl',
      message: `image_link sans extension raster reconnue. URL : « ${feed.imageUrl} ».`,
    });
  }

  // -------- Canonical URL --------
  if (!/^https?:\/\//i.test(feed.canonicalUrl)) {
    errors.push({
      code: 'canonical-not-absolute',
      level: 'error',
      path: 'canonicalUrl',
      message: `canonicalUrl doit être absolue (http/https). Reçu : « ${feed.canonicalUrl} ».`,
    });
  }

  // -------- Currency / Brand --------
  if (!/^[A-Z]{3}$/.test(feed.currency)) {
    errors.push({
      code: 'currency-format',
      level: 'error',
      path: 'currency',
      message: `currency « ${feed.currency} » non conforme ISO-4217 (3 lettres majuscules).`,
    });
  }
  if (feed.brand.trim().length === 0) {
    errors.push({
      code: 'brand-empty',
      level: 'error',
      path: 'brand',
      message: 'brand vide — Merchant exige une marque déclarée.',
    });
  }

  // -------- Pricing #14 — chiffres précis (Kolenda) --------
  if (feed.socialProof.rating === 5) {
    warnings.push({
      code: 'rating-too-round',
      level: 'warning',
      path: 'socialProof.rating',
      message:
        'Note exactement à 5/5 — manque de précision (Kolenda Pricing #14). Préférer 4.7-4.9 si la moyenne réelle le justifie.',
    });
  }
  if (
    feed.socialProof.reviewsCount > 0 &&
    feed.socialProof.reviewsCount % 100 === 0
  ) {
    warnings.push({
      code: 'reviews-count-round',
      level: 'warning',
      path: 'socialProof.reviewsCount',
      message: `Comptage d'avis « rond » (${feed.socialProof.reviewsCount}) — soupçon de fabrication. Préférer un nombre précis (Kolenda Pricing #14).`,
    });
  }

  // -------- Pricing #11 — densify the payment section --------
  const microcopyWords = feed.hero.ctaMicrocopy
    .split(/\s+/)
    .filter(Boolean).length;
  if (microcopyWords < LIMITS.CTA_MICROCOPY_MIN_WORDS) {
    warnings.push({
      code: 'cta-microcopy-thin',
      level: 'warning',
      path: 'hero.ctaMicrocopy',
      message: `Microcopy CTA trop courte (${microcopyWords} mots, recommandé ≥ ${LIMITS.CTA_MICROCOPY_MIN_WORDS}). Densify the payment section (Kolenda Pricing #11).`,
    });
  }

  return { errors, warnings };
}
