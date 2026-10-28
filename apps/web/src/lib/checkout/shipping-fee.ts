/**
 * Frais de livraison payants, au tarif de la ville (`delivery_cities`).
 *
 * Règle unique partagée client / serveur :
 *  - flag admin `freeShipping` actif → 0 ;
 *  - ville reconnue (correspondance exacte nom FR / AR / slug / alias, la même
 *    que `CityAutocomplete.exactMatch`) → `delivery_price_mad` ;
 *  - ville inconnue (frappe libre) → `DEFAULT_DELIVERY_PRICE_MAD`, le tarif le
 *    plus haut du catalogue, pour ne jamais facturer moins que le transporteur.
 *
 * Le serveur reste autoritaire : la commande ajoute SES frais au total produit
 * (`resolveShippingCents`, dans `shipping-fee-server.ts`).
 */
import type { DeliveryCity } from '@/lib/db/queries/delivery-cities';

export const DEFAULT_DELIVERY_PRICE_MAD = 45;

export function shippingCentsFromPrice(
  priceMad: number | null | undefined,
  freeShipping: boolean,
): number {
  if (freeShipping) return 0;
  const mad = typeof priceMad === 'number' && priceMad >= 0 ? priceMad : DEFAULT_DELIVERY_PRICE_MAD;
  return Math.round(mad * 100);
}

export function matchesCityExactly(
  city: Pick<DeliveryCity, 'nameFr' | 'nameAr' | 'slug' | 'aliases'>,
  input: string,
): boolean {
  const normalized = input.trim().toLocaleLowerCase();
  if (!normalized) return false;
  return [city.nameFr, city.nameAr ?? '', city.slug, ...city.aliases].some(
    (candidate) => candidate.trim().toLocaleLowerCase() === normalized,
  );
}
