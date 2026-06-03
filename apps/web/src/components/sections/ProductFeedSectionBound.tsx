/**
 * <ProductFeedSectionBound/> — wrapper RSC qui construit le `ProductFeed`
 * depuis le `Product` + `KitPageContent` reçus, puis délègue le rendu
 * à `<ProductFeedSection/>`.
 *
 * Depuis le plan `pack-section-optim-2026-05` (Phase 4) : on passe par
 * `resolveKitPack()` qui applique l'override admin publié si présent,
 * avant de déléguer. Le builder reste pur (utilisé inchangé par le feed
 * Merchant XML / JSON-LD pour Google Shopping).
 */
import { getTranslations } from 'next-intl/server';

import { ProductFeedSection } from './ProductFeedSection';
import { resolveKitPack } from '@/lib/kit/pack/resolver';
import {
  localizeKitProductFeed,
  type ProductFeedTranslate,
} from '@/lib/products/feed/localize';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';
import type { ProductReviewStats } from '@/lib/products/reviews';
import type { KitPageContent, Product } from '@/lib/schemas';

interface ProductFeedSectionBoundProps {
  product: Product;
  content: KitPageContent;
  /**
   * Stats reviews déjà résolues côté caller (RSC). Null/undefined →
   * fallback `DEFAULT_KIT_REVIEW_STATS` interne au builder.
   */
  reviewStats?: ProductReviewStats | null;
  anchorId?: string;
  /**
   * Phase 7E — locale active. En non-défaut, on applique l'overlay de
   * localisation `marketing.kit.product_feed` sur le feed FR canonique
   * (le builder reste pur pour le flux Google Shopping / JSON-LD).
   */
  locale?: Locale;
}

export async function ProductFeedSectionBound({
  product,
  content,
  reviewStats,
  anchorId,
  locale,
}: ProductFeedSectionBoundProps) {
  const { feed } = resolveKitPack(product, content, reviewStats);
  const effectiveLocale = locale ?? DEFAULT_LOCALE;

  // Coupon d'accueil (CPN-14) — résolu serveur, hors cache produit. En Phase 1
  // (holdout=0, éligibilité tout-trafic) la résolution est indépendante du
  // visiteur. La note s'affiche pour un `welcome_auto` actif.
  const { resolveCoupon } = await import('@/lib/coupons/engine');
  const activeCoupon = await resolveCoupon({});
  const welcomeCoupon =
    activeCoupon && activeCoupon.type === 'welcome_auto'
      ? { active: true, endsAt: activeCoupon.endsAt ? activeCoupon.endsAt.toISOString() : null }
      : { active: false, endsAt: null };

  // FR (défaut) : on garde la copy canonique du builder, zéro régression.
  // AR/EN : overlay des strings affichables depuis le namespace messages.
  if (effectiveLocale === DEFAULT_LOCALE) {
    return (
      <ProductFeedSection
        feed={feed}
        product={product}
        anchorId={anchorId}
        welcomeCoupon={welcomeCoupon}
        isArabic={false}
      />
    );
  }

  const t = await getTranslations({
    locale: effectiveLocale,
    namespace: 'marketing.kit.product_feed',
  });
  const localizedFeed = localizeKitProductFeed(
    feed,
    // next-intl interdit les clés dynamiques en strict ; le runtime les
    // résout sans souci (cf. localize.ts).
    t as unknown as ProductFeedTranslate,
    effectiveLocale,
  );
  return (
    <ProductFeedSection
      feed={localizedFeed}
      product={product}
      anchorId={anchorId}
      welcomeCoupon={welcomeCoupon}
      isArabic={effectiveLocale === 'ar'}
      resultLabel={t('steps.result_label')}
      reviewsCountLabel={t('social_proof.reviews_count', {
        count: localizedFeed.socialProof.reviewsCount,
      })}
    />
  );
}
