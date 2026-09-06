import 'server-only';
import type { ComponentProps } from 'react';
import { getTranslations } from 'next-intl/server';
import { HeroProduit, type HeroProduitFields } from './HeroProduit';
import { StoriesVideoBound } from './StoriesVideoBound';
import { resolveComponentFields } from '@/lib/components/field-resolver';
import {
  getKitHeroGalleryImages,
  type HeroGalleryImage,
} from '@/lib/products/kit-hero-gallery';
import {
  DEFAULT_KIT_REVIEW_STATS,
  getProductReviewStats,
  type ProductReviewStats,
} from '@/lib/products/reviews';
import type { ResolvedFields } from '@/lib/db/types';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';

type HeroProduitBoundProps = Omit<
  ComponentProps<typeof HeroProduit>,
  'galleryImages' | 'fields' | 'reviewStats'
> & {
  componentKey: string;
  /**
   * Override le count avis du fallback `DEFAULT_KIT_REVIEW_STATS`. Quand
   * la table DB `product_reviews` est vide (cas actuel), on passe ici
   * `content.handsTestimonials.length` pour afficher le count REEL des
   * témoignages visibles plus bas dans la page — au lieu du starter 287.
   */
  reviewsCountOverride?: number;
  /**
   * Phase 7B — Locale active. Propagée à `resolveComponentFields` pour
   * lire les bindings AR/EN. Sans valeur, défaut FR (legacy).
   */
  locale?: Locale;
  /**
   * Phase 7E — Nom produit localisé (CMS `content.product.name`). Affiché
   * dans le H1 du hero. Le `product.name` (nom DB canonique) reste utilisé
   * pour le tracking + cart afin de ne pas fragmenter les rapports analytics.
   */
  displayName?: string;
  /**
   * Phase 7E — Tagline localisée (CMS `content.product.tagline`). Sert de
   * fallback quand aucun binding `kit-hero-produit/tagline` n'existe pour la
   * locale active — remplace l'ancien fallback FR hardcodé qui fuitait sur
   * `/ar/kit` et `/en/kit`.
   */
  taglineFallback?: string;
};

/**
 * RSC wrapper du hero produit. Résout :
 *  - Les champs editorial (`tagline`, `description`, chips, trust row, flags)
 *    via `resolveComponentFields(componentKey)`.
 *  - La galerie d'images (slot primary + contextuels + photos clientes) via
 *    `getKitHeroGalleryImages(productId)`.
 *  - Les stats reviews (rating + count) via `getProductReviewStats`, avec
 *    fallback `DEFAULT_KIT_REVIEW_STATS` (4,8 / 287 — starter rating).
 *
 * Si la galerie résolue est vide (pas de bindings et pas de review photos),
 * on tombe sur `product.images[0]` comme image unique. Garantit que le hero
 * n'est jamais "blanc" en dev local avant seed complet.
 */
export async function HeroProduitBound({
  componentKey,
  product,
  reassurances,
  observeId,
  commanderMode,
  reviewsCountOverride,
  locale,
  displayName,
  taglineFallback,
}: HeroProduitBoundProps): Promise<JSX.Element> {
  const effectiveLocale = locale ?? DEFAULT_LOCALE;
  const productFallback = product.images[0];
  const [resolvedFields, rawGalleryImages, statsOrNull, tHero] = await Promise.all([
    resolveComponentFields(componentKey, effectiveLocale),
    getKitHeroGalleryImages({
      productId: product.id,
      maxTotal: pickNumber(undefined, 7),
      // Garantit que le packshot produit reste en première position de la
      // galerie même quand aucun binding Component-Media n'est défini sur
      // `kit-hero-produit/primary` (cas dev local sans seed admin).
      productFallback: productFallback
        ? {
            src: productFallback.src,
            alt: productFallback.alt,
            width: productFallback.width,
            height: productFallback.height,
            blurDataURL: productFallback.blurDataURL,
          }
        : undefined,
    }),
    getProductReviewStats(product.id),
    // Phase 7E — strings UI du hero (kicker, CTA, économie) localisés.
    getTranslations({
      locale: effectiveLocale,
      namespace: 'marketing.kit.hero',
    }),
  ]);

  // Phase 7E — économie en MAD (entier) pour le libellé localisé `savings`.
  const savings = product.promoPriceCents
    ? Math.round((product.priceCents - product.promoPriceCents) / 100)
    : 0;
  const heroStrings = {
    kicker: tHero('kicker'),
    ctaLabel: tHero('cta_commander'),
    savingsLabel: savings > 0 ? tHero('savings', { savings }) : undefined,
    // Gabarits pour recalcul client quand un code promo change le montant
    // (jeton conservé : on passe un texte, next-intl le substitue tel quel).
    savingsLabelTemplate: tHero('savings', { savings: '{savings}' }),
    promoAppliedLabelTemplate: tHero('promo_applied', { code: '{code}' }),
  };

  // Fields avec fallback sur defaults solides
  // Phase 7B — En non-default locale, on ignore les valeurs `source === 'default'`
  // (= valeurs FR du registry) afin que `data.product` ou les helpers de page
  // localisés puissent fournir le bon contenu. Cf. PHASE-7-AUDIT.md §A6.
  const acceptDefault = effectiveLocale === DEFAULT_LOCALE;
  const fields: HeroProduitFields = {
    tagline: pickString(
      resolvedFields.tagline,
      taglineFallback ??
        'Manucure japonaise. Deux gestes, un polissoir. La main se révèle.',
      acceptDefault,
    ),
    description: pickString(resolvedFields.description, '', acceptDefault),
    attributeChips: pickStringArray(
      resolvedFields.attributeChips,
      // Phase 7E — fallback localisé (FR/AR/EN) depuis `marketing.kit.hero.chips`.
      // En FR, ces valeurs sont identiques aux anciennes constantes hardcodées.
      [tHero('chips.no_polish'), tHero('chips.no_uv'), tHero('chips.no_acetone')],
      acceptDefault,
    ),
    trustRow: pickStringArray(
      resolvedFields.trustRow,
      // Phase 7E — fallback localisé (FR/AR/EN) depuis `marketing.kit.hero.trust`.
      [tHero('trust.delivery'), tHero('trust.cod')],
      acceptDefault,
    ),
    reviewBadgeEnabled: pickBoolean(resolvedFields.reviewBadgeEnabled, true),
    ctaPulseEnabled: pickBoolean(resolvedFields.ctaPulseEnabled, true),
  };

  // Galerie résolue côté helper — le fallback produit est passé en option,
  // donc on est garanti d'avoir au minimum 1 image (le packshot) tant que
  // `product.images[0]` existe.
  const galleryImages: HeroGalleryImage[] = rawGalleryImages;

  // Si la DB n'a pas encore de reviews et qu'un override est fourni par
  // le parent (count des handsTestimonials CMS visibles plus bas), on
  // l'utilise — c'est plus honnête que le starter 287 hardcodé tant que
  // la table `product_reviews` n'existe pas. Dès que des reviews réelles
  // entrent en DB, `statsOrNull` devient non-null et l'override est ignoré.
  const fallbackStats: ProductReviewStats =
    statsOrNull ??
    (typeof reviewsCountOverride === 'number' && reviewsCountOverride > 0
      ? { rating: DEFAULT_KIT_REVIEW_STATS.rating, reviewsCount: reviewsCountOverride }
      : DEFAULT_KIT_REVIEW_STATS);
  const reviewStats: ProductReviewStats = fallbackStats;

  // Phase 9bis — libellé avis localisé (« {n} avis » → « {n} تقييم »). En FR
  // le rendu reste identique ; le badge n'a plus de "avis" hardcodé.
  const ratingDisplay = (Math.round(reviewStats.rating * 10) / 10)
    .toString()
    .replace('.', ',');
  const reviewsStrings = {
    reviewsLabel: tHero('reviews', { count: reviewStats.reviewsCount }),
    reviewsAriaLabel: tHero('reviews_aria', {
      count: reviewStats.reviewsCount,
      rating: ratingDisplay,
    }),
  };

  return (
    <HeroProduit
      product={product}
      displayName={displayName}
      strings={{ ...heroStrings, ...reviewsStrings }}
      reassurances={reassurances}
      galleryImages={galleryImages}
      fields={fields}
      reviewStats={reviewStats}
      observeId={observeId}
      commanderMode={commanderMode}
      // Rend le badge cliquable → scroll vers le bloc « Les voix de la
      // maison » (RitualsModule, id H2="rituals-module-title"). C'est le
      // gros bloc social proof à grande échelle (47 rituels partagés en
      // DB courante). Si le module rituels n'est pas rendu (cas test),
      // l'ancre tombe en no-op silencieux côté navigateur.
      reviewsAnchorHref="#rituals-module-title"
      // MOBILE : bloc stories sous les images du hero, avant le titre.
      // Desktop : masqué ici (le bloc reste après le hero dans la page).
      storiesSlot={<StoriesVideoBound locale={locale} variant="inline" />}
    />
  );
}

function pickString(
  field: ResolvedFields[string] | undefined,
  fallback: string,
  acceptDefault = true,
): string {
  if (!field) return fallback;
  // Phase 7B — En non-default locale, on refuse `source === 'default'`
  // (= valeurs FR du registry) pour préserver le fallback localisé.
  if (!acceptDefault && field.meta.source === 'default') return fallback;
  const v = field.value;
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
}

function pickBoolean(field: ResolvedFields[string] | undefined, fallback: boolean): boolean {
  const v = field?.value;
  return typeof v === 'boolean' ? v : fallback;
}

function pickStringArray(
  field: ResolvedFields[string] | undefined,
  fallback: string[],
  acceptDefault = true,
): string[] {
  if (!field) return fallback;
  if (!acceptDefault && field.meta.source === 'default') return fallback;
  const v = field.value;
  if (!Array.isArray(v)) return fallback;
  const cleaned = v
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return cleaned.length > 0 ? cleaned : fallback;
}

function pickNumber(
  field: ResolvedFields[string] | undefined,
  fallback: number,
): number {
  const v = field?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
