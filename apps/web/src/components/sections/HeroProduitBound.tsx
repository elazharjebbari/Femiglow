import 'server-only';
import type { ComponentProps } from 'react';
import { HeroProduit, type HeroProduitFields } from './HeroProduit';
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

type HeroProduitBoundProps = Omit<
  ComponentProps<typeof HeroProduit>,
  'galleryImages' | 'fields' | 'reviewStats'
> & {
  componentKey: string;
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
}: HeroProduitBoundProps): Promise<JSX.Element> {
  const productFallback = product.images[0];
  const [resolvedFields, rawGalleryImages, statsOrNull] = await Promise.all([
    resolveComponentFields(componentKey),
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
  ]);

  // Fields avec fallback sur defaults solides
  const fields: HeroProduitFields = {
    tagline: pickString(
      resolvedFields.tagline,
      'Manucure japonaise. Deux gestes, un polissoir. La main se révèle.',
    ),
    description: pickString(resolvedFields.description, ''),
    attributeChips: pickStringArray(
      resolvedFields.attributeChips,
      ['Sans vernis', 'Sans UV', 'Sans acétone'],
    ),
    trustRow: pickStringArray(resolvedFields.trustRow, [
      'Livraison offerte',
      'Paiement à la livraison',
      'Retour 30 jours',
    ]),
    reviewBadgeEnabled: pickBoolean(resolvedFields.reviewBadgeEnabled, true),
    ctaPulseEnabled: pickBoolean(resolvedFields.ctaPulseEnabled, true),
  };

  // Galerie résolue côté helper — le fallback produit est passé en option,
  // donc on est garanti d'avoir au minimum 1 image (le packshot) tant que
  // `product.images[0]` existe.
  const galleryImages: HeroGalleryImage[] = rawGalleryImages;

  const reviewStats: ProductReviewStats = statsOrNull ?? DEFAULT_KIT_REVIEW_STATS;

  return (
    <HeroProduit
      product={product}
      reassurances={reassurances}
      galleryImages={galleryImages}
      fields={fields}
      reviewStats={reviewStats}
      observeId={observeId}
      commanderMode={commanderMode}
    />
  );
}

function pickString(field: ResolvedFields[string] | undefined, fallback: string): string {
  const v = field?.value;
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback;
}

function pickBoolean(field: ResolvedFields[string] | undefined, fallback: boolean): boolean {
  const v = field?.value;
  return typeof v === 'boolean' ? v : fallback;
}

function pickStringArray(
  field: ResolvedFields[string] | undefined,
  fallback: string[],
): string[] {
  const v = field?.value;
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
