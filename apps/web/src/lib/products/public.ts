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

/**
 * Résout le pricing public du kit COUPON-AWARE.
 *
 * Le coupon devient la SOURCE de la promotion : on part du prix DB
 * (`priceCents` + `promoPriceCents` brut comme fallback) et on applique le
 * moteur de coupons. La résolution coupon vit HORS du cache produit
 * (`getKitProductCached`, tag `products`) : `resolveProductPricing` lit sa
 * propre source cachée (tag `coupons`) et réévalue la validité à `now`.
 *
 * `ctx` est optionnel — en Phase 1 (holdout=0, éligibilité tout-trafic) la
 * résolution est indépendante du visiteur, donc un contexte vide suffit.
 * cf. docs/coupons-qa-2026-06-02/{06,16}-*.
 */
export async function resolveKitPricing(
  ctx: import('@/lib/coupons/types').CouponContext = {},
): Promise<{
  product: PublicProduct;
  pricing: import('@/lib/coupons/types').ResolvedPricing;
}> {
  const { resolveProductPricing } = await import('@/lib/coupons/engine');
  const kit = await buildKitPublicProduct();
  const pricing = await resolveProductPricing(
    {
      priceCents: kit.priceCents,
      promoPriceCents: kit.promoPriceCents,
      sku: kit.primaryVariantSku,
      currency: kit.currency,
    },
    ctx,
  );
  // Le prix affiché dérive du coupon : promoPriceCents = prix remisé si une
  // remise est active, sinon null (pas de prix barré).
  const product: PublicProduct = {
    ...kit,
    promoPriceCents: pricing.active ? pricing.effectivePriceCents : null,
  };
  return { product, pricing };
}

/**
 * Valeur monétaire d'un lead = **prix du kit avec la promotion** (prix
 * effectivement payé). Sert à valoriser les conversions `generate_lead`
 * (chat, formulaires) pour le bidding value-based Meta/Google Ads.
 *
 * Server-authoritative : la valeur n'est jamais dupliquée côté client.
 * `value` en unité majeure (MAD), pas en centimes — aligné sur le contrat
 * dataLayer (`params.value`) et sur le checkout (`total / 100`).
 *
 * COUPON-AWARE : la valeur reflète le coupon résolu (et reste correcte si
 * `promoPriceCents` est retiré au profit du coupon).
 *
 * cf. docs/tracking-audit-2026-05-31 (T-06) + coupons-qa-2026-06-02/16.
 */
export async function getKitLeadValue(): Promise<{ value: number; currency: string }> {
  const { pricing, product } = await resolveKitPricing();
  return { value: pricing.effectivePriceCents / 100, currency: product.currency };
}
