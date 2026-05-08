/**
 * <ProductFeedSectionBound/> — wrapper RSC qui construit le `ProductFeed`
 * depuis le `Product` + `KitPageContent` reçus, puis délègue le rendu
 * à `<ProductFeedSection/>`.
 *
 * On garde le builder côté serveur pour :
 *  - éviter d'expédier la copy + les principes Kolenda dans le bundle JS,
 *  - permettre aux pages admin (preview, XML feed) de réutiliser exactement
 *    la même fonction sans dupliquer la logique éditoriale.
 */
import { ProductFeedSection } from './ProductFeedSection';
import { buildKitProductFeed } from '@/lib/products/feed/kit-feed';
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
  const feed = buildKitProductFeed(product, content, reviewStats);
  return <ProductFeedSection feed={feed} product={product} anchorId={anchorId} />;
}
