/**
 * Prix du kit tel qu'affiché à CETTE visiteuse — source unique pour le hero,
 * la barre fixe, le JSON-LD, le `view_item` et le panier du formulaire.
 *
 * Avant (audit /kit du 10/11/2026) : le hero et le panier lisaient le prix
 * promo brut de la variante, la commande repriçait avec le moteur de coupons.
 * Un coupon automatique sur le prix faisait diverger les deux : 422 à la
 * commande. Désormais tout passe par le moteur, avec le contexte de la
 * requête, et le panier porte un devis signé (`price-quote.ts`) que la
 * commande honore.
 *
 * `cache()` : un seul calcul par requête, partagé par la page, le layout et
 * la section commande (même contexte, donc même prix partout).
 */
import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';

import { buildCouponContext } from '@/lib/coupons/context';
import type { ResolvedPricing } from '@/lib/coupons/types';
import { signPriceQuote } from '@/lib/checkout/price-quote';
import type { Product as PublicProduct } from '@/lib/schemas';
import { buildKitPublicProduct } from '@/lib/products/public';

export interface KitDisplayPricing {
  /** Produit dont `promoPriceCents` reflète le prix réellement facturé. */
  product: PublicProduct;
  pricing: ResolvedPricing;
  /** Devis signé du prix unitaire, ou null si aucun secret serveur. */
  priceQuote: string | null;
}

/** Contexte coupon de la requête courante (mêmes primitives que la commande). */
export function requestCouponContext() {
  const h = headers();
  const c = cookies();
  return buildCouponContext({
    referer: h.get('referer'),
    userAgent: h.get('user-agent'),
    sessionId: c.get('fg_session_id')?.value ?? c.get('_fbp')?.value ?? null,
  });
}

export const resolveKitDisplayPricing = cache(async (): Promise<KitDisplayPricing> => {
  const base = await buildKitPublicProduct();
  const { resolveProductPricing } = await import('@/lib/coupons/engine');
  const pricing = await resolveProductPricing(
    {
      priceCents: base.priceCents,
      promoPriceCents: base.promoPriceCents,
      sku: base.primaryVariantSku,
      currency: base.currency,
    },
    requestCouponContext(),
  );
  const product: PublicProduct = {
    ...base,
    promoPriceCents: pricing.active ? pricing.effectivePriceCents : null,
  };
  // Sans SKU (repli sur le mock, produit absent en base) : pas de devis, la
  // commande reprice comme avant.
  const sku = base.primaryVariantSku;
  const priceQuote = sku
    ? signPriceQuote({
        sku,
        unit: pricing.effectivePriceCents,
        cur: base.currency,
        save: pricing.coupon && pricing.coupon.bucket === 'treatment' ? pricing.savingsCents : 0,
        cpn: pricing.coupon,
      base: base.priceCents,
      promo: base.promoPriceCents ?? null,
      })
    : null;
  return { product, pricing, priceQuote };
});
