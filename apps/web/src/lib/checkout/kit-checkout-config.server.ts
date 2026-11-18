import 'server-only';

/**
 * Kit CRO v2 §2 — Lecture serveur du réglage `kit-checkout` (mode
 * d'ouverture du formulaire). Mise en cache par `resolveComponentFields`
 * (tags `components:fields:kit-checkout:*`, invalidés à la publication).
 *
 * Tolérant : base indisponible ou composant non synchronisé → réglage par
 * défaut (`scroll`, comportement historique). Le checkout ne doit jamais
 * casser à cause d'un réglage d'A/B.
 *
 * `CHECKOUT_STEP2_V2=off` : coupe-circuit de l'étape 2 progressive, sans passer
 * par le CMS. `CHECKOUT_STEP2_ACK=off` : même chose pour l'accusé « C'est noté ».
 */

import { resolveComponentFields } from '@/lib/components/field-resolver';
import {
  DEFAULT_KIT_CHECKOUT_CONFIG,
  KIT_CHECKOUT_COMPONENT_KEY,
  KIT_CHECKOUT_LOCALE,
  parseKitCheckoutConfig,
  type KitCheckoutConfig,
} from '@/lib/checkout/kit-checkout-config';

export async function getKitCheckoutConfig(): Promise<KitCheckoutConfig> {
  try {
    const fields = await resolveComponentFields(KIT_CHECKOUT_COMPONENT_KEY, KIT_CHECKOUT_LOCALE);
    const config = parseKitCheckoutConfig(fields);
    return {
      ...config,
      ...(process.env.CHECKOUT_STEP2_V2 === 'off' ? { step2V2SharePct: 0 } : {}),
      ...(process.env.CHECKOUT_STEP2_ACK === 'off' ? { step2AckSharePct: 0 } : {}),
    };
  } catch {
    return DEFAULT_KIT_CHECKOUT_CONFIG;
  }
}
