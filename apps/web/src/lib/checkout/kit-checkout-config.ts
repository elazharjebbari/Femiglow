/**
 * Kit CRO v2 §2 — Réglage du composant CMS `kit-checkout` (pur, partagé
 * serveur/client).
 *
 * `parseKitCheckoutConfig` transforme les champs résolus (cascade binding
 * publié ▸ défaut du registre) en réglage typé, avec repli sûr sur le
 * comportement historique (`scroll`) si une valeur est absente ou invalide.
 */

import type { ResolvedFields } from '@/lib/db/types';
import {
  DEFAULT_COMMANDER_CMS_MODE,
  DEFAULT_SHEET_SHARE_PCT,
  isCommanderCmsMode,
  normalizeSharePct,
  type CommanderCmsMode,
} from '@/lib/checkout/commander-mode';

export const KIT_CHECKOUT_COMPONENT_KEY = 'kit-checkout';
/**
 * Réglage commercial global (pas un texte) : une seule valeur pour FR/AR/EN,
 * lue sur la locale `fr` — même convention que `global-promo-slide-header`.
 */
export const KIT_CHECKOUT_LOCALE = 'fr';

export interface KitCheckoutConfig {
  ctaMode: CommanderCmsMode;
  /** Part (0–100) des visiteurs en panneau quand `ctaMode === 'ab'`. */
  sheetSharePct: number;
}

export const DEFAULT_KIT_CHECKOUT_CONFIG: KitCheckoutConfig = {
  ctaMode: DEFAULT_COMMANDER_CMS_MODE,
  sheetSharePct: DEFAULT_SHEET_SHARE_PCT,
};

export function parseKitCheckoutConfig(
  fields: ResolvedFields | null | undefined,
): KitCheckoutConfig {
  const rawMode = fields?.ctaMode?.value;
  const rawPct = fields?.sheetSharePct?.value;
  return {
    ctaMode: isCommanderCmsMode(rawMode) ? rawMode : DEFAULT_KIT_CHECKOUT_CONFIG.ctaMode,
    sheetSharePct:
      rawPct === null || rawPct === undefined
        ? DEFAULT_KIT_CHECKOUT_CONFIG.sheetSharePct
        : normalizeSharePct(rawPct),
  };
}
