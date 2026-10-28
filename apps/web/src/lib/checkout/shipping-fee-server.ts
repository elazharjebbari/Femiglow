/**
 * Résolution serveur des frais de livraison — voir `shipping-fee.ts`.
 * Fichier séparé : il importe la couche DB, à ne jamais tirer côté client.
 */
import { getShippingConfig } from '@/lib/checkout/shipping-config';
import { matchesCityExactly, shippingCentsFromPrice } from '@/lib/checkout/shipping-fee';
import { searchDeliveryCities } from '@/lib/db/queries/delivery-cities';

/** Serveur — frais (centimes) pour la ville saisie sur le lead. */
export async function resolveShippingCents(city: string | null | undefined): Promise<number> {
  const { freeShipping } = await getShippingConfig();
  if (freeShipping) return 0;
  const name = (city ?? '').trim();
  if (!name) return shippingCentsFromPrice(null, false);
  const candidates = await searchDeliveryCities(name, { limit: 8 });
  const match = candidates.find((c) => matchesCityExactly(c, name)) ?? null;
  return shippingCentsFromPrice(match?.deliveryPriceMad ?? null, false);
}
