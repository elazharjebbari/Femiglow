/**
 * Public-facing product helpers — branche `/kit` sur la DB.
 *
 * - `getKitProductCached()` : Drizzle/memoryStore via `getProductBySlug`,
 *   wrappé en `unstable_cache` taggué `products` + `product:le-kit`.
 * - `buildKitPublicProduct()` : merge le DB Product + variantes vers la
 *   forme `Product` attendue par les sections marketing (mock comme
 *   fallback pour les champs éditoriaux non-DB : images, composition…).
 *
 * Le slug DB est aligné sur `KIT_PRODUCT_SLUG = 'le-kit'`. La métadonnée
 * SEO + JSON-LD passe par `resolveSeoMetadata({ scope: 'product', ... })`.
 */
import { unstable_cache } from 'next/cache';
import { mockKit } from '@/data/mock';
import { getProductBySlug } from '@/lib/db/queries/products';
import { PRODUCTS_TAG, productTag } from '@/lib/products/cache';
import { isSupportedCurrency } from '@/lib/products/currency';
import type { Product as PublicProduct } from '@/lib/schemas';
import type { ProductWithVariants } from '@/lib/products/types';

export const KIT_PRODUCT_SLUG = 'le-kit';
export const KIT_LOCALE = 'fr-MA';

export const getKitProductCached = unstable_cache(
  async (): Promise<ProductWithVariants | null> =>
    getProductBySlug(KIT_PRODUCT_SLUG),
  ['public:kit-product', KIT_PRODUCT_SLUG],
  { tags: [PRODUCTS_TAG, productTag(KIT_PRODUCT_SLUG)] },
);

/**
 * Construit la forme `Product` (côté marketing) à partir du DB Product
 * publié si dispo, sinon fallback intégral sur le mock.
 */
export async function buildKitPublicProduct(): Promise<PublicProduct> {
  const data = await getKitProductCached();
  if (!data || data.product.status !== 'published') return mockKit;
  const { product, variants } = data;
  const primary = variants[0];
  // La colonne DB stocke un `string` libre ; on normalise via le whitelist
  // central `SUPPORTED_CURRENCIES`. Si la valeur n'y figure pas (donnée
  // legacy / saisie hors enum), on retombe sur la devise du mock plutôt
  // que de jeter — la page kit ne doit pas planter pour un libellé.
  const dbCurrency = primary?.currency;
  const currency: PublicProduct['currency'] = isSupportedCurrency(dbCurrency)
    ? dbCurrency
    : mockKit.currency;
  // Promo : on n'expose une valeur côté public que si elle est strictement
  // inférieure au prix barré (contrat <PriceDisplay>). Une saisie incohérente
  // côté admin (promo >= prix) est ignorée silencieusement plutôt que de
  // dégrader l'UX publique.
  const rawPromo = primary?.promoPriceCents ?? null;
  const basePrice = primary?.priceCents ?? mockKit.priceCents;
  const promoPriceCents =
    rawPromo !== null && rawPromo > 0 && rawPromo < basePrice ? rawPromo : null;
  return {
    ...mockKit,
    id: product.id,
    slug: product.slug,
    name: product.title,
    tagline: product.tagline ?? mockKit.tagline,
    description: product.description ?? mockKit.description,
    priceCents: basePrice,
    promoPriceCents,
    currency,
    inStock:
      primary?.inventoryStatus === undefined
        ? mockKit.inStock
        : primary.inventoryStatus !== 'out_of_stock',
    primaryVariantSku: primary?.sku ?? mockKit.primaryVariantSku,
    primaryVariantId: primary?.id ?? mockKit.primaryVariantId,
  };
}
