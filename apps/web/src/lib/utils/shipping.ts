import type { ShippingMode, VilleMaroc } from '@/lib/schemas';

/**
 * Audit 08/09 — Centre de gravit\u00E9 Rabat. Les tarifs « capitale » s'appliquent
 * d'abord \u00E0 Rabat (24 h) puis \u00E0 Casablanca/Sal\u00E9 (24-48 h). Le reste du Maroc
 * passe sous le tarif standard (48 \u00E0 72 h). Le flag `freeShipping` continue
 * d'aplanir \u00E0 0 — c'est le mode commercial nominal d\u00E9cid\u00E9 dans le brief.
 */
const STANDARD_CAPITAL_CENTS = 4000;
const STANDARD_REST_CENTS = 6000;
const EXPRESS_CAPITAL_CENTS = 8000;

const CAPITAL_CITIES = new Set(['rabat', 'casablanca', 'casa', 'sale', 'salé']);

export function computeShippingCents(input: {
  city?: VilleMaroc | string;
  mode?: ShippingMode;
  /**
   * Quand `true`, force 0 — utilisé quand le flag admin `freeShipping`
   * est activé. Les surfaces UI continuent d'afficher le prix catalogue
   * barré pour signaler la valeur offerte.
   */
  freeShipping?: boolean;
}): number {
  if (input.freeShipping) return 0;
  const city = (input.city ?? '').toString().toLowerCase();
  const mode = input.mode ?? 'standard';
  if (mode === 'express') {
    return EXPRESS_CAPITAL_CENTS;
  }
  if (CAPITAL_CITIES.has(city)) return STANDARD_CAPITAL_CENTS;
  return STANDARD_REST_CENTS;
}

export function isExpressAvailable(city?: VilleMaroc | string): boolean {
  return CAPITAL_CITIES.has((city ?? '').toString().toLowerCase());
}

export const shippingLabel = {
  standard: 'Standard · livraison offerte au Maroc',
  express: 'Express · 24 h Rabat',
} as const;
