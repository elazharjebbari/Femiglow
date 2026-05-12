/**
 * CHA-232 — Configuration livraison (server-side helper).
 *
 * Lit le flag `freeShipping` depuis la cascade admin-config (`flags` section).
 * Par défaut (et si le flag absent), la livraison est **offerte** : `true`.
 *
 * Surfaces qui consomment :
 *   - `/api/checkout/shipping-config` → expose au client via `useShippingConfig()`.
 *   - `computeShippingCents()` (utils) → accepte le flag pour forcer 0.
 *   - Composants display → barrer le prix catalogue + afficher "Offerte".
 *
 * L'admin toggle est dans `/admin/settings/flags` (clé `freeShipping`).
 */
import { getSection } from '@/lib/admin-config/resolve';

export interface ShippingConfig {
  freeShipping: boolean;
}

const DEFAULT_FREE_SHIPPING = true;

export async function getShippingConfig(): Promise<ShippingConfig> {
  try {
    const resolved = await getSection('flags');
    const value = resolved.payload.flags?.freeShipping;
    if (typeof value === 'boolean') return { freeShipping: value };
    return { freeShipping: DEFAULT_FREE_SHIPPING };
  } catch {
    return { freeShipping: DEFAULT_FREE_SHIPPING };
  }
}
