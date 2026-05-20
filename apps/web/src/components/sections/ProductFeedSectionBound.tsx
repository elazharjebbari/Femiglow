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
import { ProductFeedSection } from './ProductFeedSection';
import { resolveKitPack } from '@/lib/kit/pack/resolver';
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
}

export function ProductFeedSectionBound({
  product,
  content,
  reviewStats,
  anchorId,
}: ProductFeedSectionBoundProps) {
  const { feed } = resolveKitPack(product, content, reviewStats);
  return <ProductFeedSection feed={feed} product={product} anchorId={anchorId} />;
}
