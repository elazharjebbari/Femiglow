import 'server-only';
import type { ComponentProps } from 'react';
import { getTranslations } from 'next-intl/server';
import { recommendationPct } from '@/components/commerce/RecommendationProof';
import { HeroProduit, type HeroProduitFields } from './HeroProduit';
import { StoriesVideoBound } from './StoriesVideoBound';
import { resolveComponentFields } from '@/lib/components/field-resolver';
import {
  getKitHeroGalleryImages,
  type HeroGalleryImage,
} from '@/lib/products/kit-hero-gallery';
import { getKitReviewStats, type ProductReviewStats } from '@/lib/products/reviews';
import type { ResolvedFields } from '@/lib/db/types';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';
import type { KitAngle } from '@/lib/kit/angle';
import { resolveKitCtaCopy } from '@/lib/kit/cta-copy.server';
import {
  KIT_HERO_ANGLES_COMPONENT_KEY,
  resolveKitHeroAngleCopy,
} from '@/lib/kit/hero-angle-copy';

type HeroProduitBoundProps = Omit<
  ComponentProps<typeof HeroProduit>,
  'galleryImages' | 'fields' | 'reviewStats' | 'kitAngle' | 'priceLocale'
> & {
  componentKey: string;
  /**
   * Stats d'avis déjà résolues par la page (`getKitReviewStats`) — même
   * objet que le bloc pack/prix et le JSON-LD. `null` → badge masqué.
   * `undefined` → le wrapper les résout lui-même (même source).
   */
  reviewStats?: ProductReviewStats | null;
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
  /**
   * Kit CRO v2 §3 — angle publicitaire résolu par la page (`?angle=` >
   * `utm_content` > cookie `fg_angle`). `null` : titre par défaut.
   */
  kitAngle?: KitAngle | null;
};

/**
 * RSC wrapper du hero produit. Résout :
 *  - Les champs editorial (`tagline`, `description`, chips, trust row, flags)
 *    via `resolveComponentFields(componentKey)`.
 *  - La galerie d'images (slot primary + contextuels + photos clientes) via
 *    `getKitHeroGalleryImages(productId)`.
 *  - Les stats d'avis (compteur + note) via `getKitReviewStats` — source
 *    unique ; sans donnée, le badge est masqué.
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
  reviewStats: reviewStatsProp,
  locale,
  displayName,
  taglineFallback,
  initialCoupon,
  kitAngle = null,
}: HeroProduitBoundProps): Promise<JSX.Element> {
  const effectiveLocale = locale ?? DEFAULT_LOCALE;
  const productFallback = product.images[0];
  const [
    resolvedFields,
    rawGalleryImages,
    statsOrNull,
    tHero,
    angleFields,
    ctaCopy,
  ] = await Promise.all([
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
    reviewStatsProp !== undefined
      ? Promise.resolve(reviewStatsProp)
      : getKitReviewStats(product.id),
    // Phase 7E — strings UI du hero (kicker, CTA, économie) localisés.
    getTranslations({
      locale: effectiveLocale,
      namespace: 'marketing.kit.hero',
    }),
    // Kit CRO v2 §3 — tous les angles en UN appel caché (pas de cache par
    // angle) ; l'angle est choisi en mémoire. Lu seulement si un angle est
    // présent. Base indisponible → titre par défaut.
    kitAngle
      ? resolveComponentFields(KIT_HERO_ANGLES_COMPONENT_KEY, effectiveLocale).catch(() => null)
      : Promise.resolve(null),
    // Kit CRO v2 §4 — libellés du bouton et micro-texte (`kit-cta` ▸ i18n).
    resolveKitCtaCopy(effectiveLocale),
  ]);

  // Phase 7E — économie en MAD (entier) pour le libellé localisé `savings`.
  const savings = product.promoPriceCents
    ? Math.round((product.priceCents - product.promoPriceCents) / 100)
    : 0;
  // Phase 7B — en AR/EN, les valeurs par défaut du registre (FR) sont ignorées.
  const acceptDefault = effectiveLocale === DEFAULT_LOCALE;
  const titleCopy = resolveKitHeroAngleCopy(
    angleFields,
    kitAngle,
    {
      kicker: tHero('kicker'),
      titleCategory: tHero('title_category'),
      titlePromise: tHero('title_promise'),
    },
    { acceptDefault },
  );
  const heroStrings = {
    kicker: titleCopy.kicker,
    titleCategory: titleCopy.titleCategory,
    titlePromise: titleCopy.titlePromise,
    ctaLabel: ctaCopy.primary,
    ctaMicrocopy: ctaCopy.microcopy,
    savingsLabel: savings > 0 ? tHero('savings', { savings }) : undefined,
    // Gabarits pour recalcul client quand un code promo change le montant
    // (jeton conservé : on passe un texte, next-intl le substitue tel quel).
    savingsLabelTemplate: tHero('savings', { savings: '{savings}' }),
    promoAppliedLabelTemplate: tHero('promo_applied', { code: '{code}' }),
    promoAutoAppliedLabel: tHero('promo_auto_applied'),
  };

  // Fields avec fallback sur defaults solides
  // Phase 7B — En non-default locale, on ignore les valeurs `source === 'default'`
  // (= valeurs FR du registry) afin que `data.product` ou les helpers de page
  // localisés puissent fournir le bon contenu. Cf. PHASE-7-AUDIT.md §A6.
  const fields: HeroProduitFields = {
    tagline: pickString(
      resolvedFields.tagline,
      taglineFallback ??
        'Halal, formulée à Rabat. Quatre gestes, cinq minutes, une fois par semaine.',
      acceptDefault,
    ),
    description: pickString(resolvedFields.description, '', acceptDefault),
    attributeChips: pickStringArray(
      resolvedFields.attributeChips,
      // Phase 7E — fallback localisé (FR/AR/EN) depuis `marketing.kit.hero.chips`.
      // En FR, ces valeurs sont identiques aux anciennes constantes hardcodées.
      [
        // « Sans vernis » et « Compatible woudou » sont déjà portés par le
        // kicker et le titre : les répéter en chips surchargerait l'écran 1.
        tHero('chips.no_uv'),
        tHero('chips.no_acetone'),
      ],
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

  // Source unique (`getKitReviewStats`) : compteur des témoignages
  // approuvés + note réelle si elle existe. Sans donnée → badge masqué.
  const reviewStats: ProductReviewStats | null = statsOrNull;

  // Phase 9bis — libellé avis localisé (« {n} avis » → « {n} تقييم »).
  const recommendPct = reviewStats
    ? recommendationPct(reviewStats.recommendCount ?? 0, reviewStats.reviewsCount)
    : 0;
  const reviewsStrings = reviewStats
    ? {
        reviewsRecommend: tHero('reviews_recommend', { pct: recommendPct }),
        reviewsVerified: tHero('reviews_verified', { count: reviewStats.verifiedCount ?? 0 }),
        reviewsReadReviews: tHero('reviews_read_reviews'),
        reviewsRecommendAria: tHero('reviews_recommend_aria', {
          pct: recommendPct,
          count: reviewStats.reviewsCount,
        }),
        reviewsLabel: tHero('reviews', { count: reviewStats.reviewsCount }),
        reviewsAriaLabel:
          reviewStats.rating === null
            ? tHero('reviews', { count: reviewStats.reviewsCount })
            : tHero('reviews_aria', {
                count: reviewStats.reviewsCount,
                rating: (Math.round(reviewStats.rating * 10) / 10)
                  .toString()
                  .replace('.', ','),
              }),
      }
    : {};

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
      // gros bloc social proof à grande échelle, dont le compteur est le
      // même que celui du badge. Si le module rituels n'est pas rendu (cas test),
      // l'ancre tombe en no-op silencieux côté navigateur.
      reviewsAnchorHref="#rituals-module-title"
      // MOBILE : bloc stories sous les images du hero, avant le titre.
      // Desktop : masqué ici (le bloc reste après le hero dans la page).
      storiesSlot={<StoriesVideoBound locale={locale} variant="inline" />}
      // Code de campagne validé côté serveur : le hero porte le prix remisé
      // dès le premier paint, sans attendre l'hydratation.
      initialCoupon={initialCoupon}
      kitAngle={kitAngle}
      priceLocale={effectiveLocale}
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
