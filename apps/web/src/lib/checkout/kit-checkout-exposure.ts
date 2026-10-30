/**
 * Kit CRO v2 §2 — Exposition au test A/B « Commander » (défilement / panneau).
 *
 * Un événement first-party `kit_checkout_exposure` par page vue, émis dès
 * que la variante est résolue : c'est le dénominateur du test (visiteurs
 * réellement exposés à chaque bras), à rapprocher de `orders.variant_key`
 * (`A` = scroll, `B` = sheet) et des événements de checkout.
 *
 * First-party uniquement (cf. `lib/tracking/first-party-events.ts`) : stocké
 * dans `tracking_events_log`, jamais poussé dans le `dataLayer` ni relayé à
 * Meta, TikTok ou Google.
 *
 * Module pur, à l'exception du drapeau « déjà émis » : une variable de module
 * vit exactement le temps d'un chargement de page (un remontage de la section
 * ne ré-émet pas).
 */

import type { CommanderAssignment, CommanderCmsMode } from '@/lib/checkout/commander-mode';
import type { KitAngle } from '@/lib/kit/angle';
import { heroMediaTrackingParams, type HeroMediaTrackingParams } from '@/lib/kit/hero-media';

export const KIT_CHECKOUT_EXPOSURE_EVENT = 'kit_checkout_exposure';

/**
 * Paramètres de l'événement (cf. `eventSchemas.kit_checkout_exposure`).
 * Alias de type (et non interface) : assignable au `Record` attendu par `emit`.
 */
export type KitCheckoutExposureParams = {
  assigned_mode: CommanderAssignment['mode'];
  mode_source: CommanderAssignment['source'];
  cms_mode: CommanderCmsMode;
  share_pct: number;
  kit_angle?: KitAngle | 'none';
  /** Images par audience (drapeau actif uniquement), cf. `lib/kit/hero-media.ts`. */
  hero_media_variant?: string;
  hero_media_level?: number;
};

export interface KitCheckoutExposureInput {
  assignment: CommanderAssignment;
  cmsMode: CommanderCmsMode;
  sharePct: number;
  /** Angle publicitaire posé sur le hero (`data-kit-angle`), si présent. */
  kitAngle?: KitAngle | 'none' | null;
  /** Variante d'images du hero (`readHeroMediaTrackingFromDocument`), si présente. */
  heroMedia?: HeroMediaTrackingParams | null;
}

export function buildKitCheckoutExposureParams({
  assignment,
  cmsMode,
  sharePct,
  kitAngle,
  heroMedia,
}: KitCheckoutExposureInput): KitCheckoutExposureParams {
  return {
    assigned_mode: assignment.mode,
    mode_source: assignment.source,
    cms_mode: cmsMode,
    share_pct: Math.min(100, Math.max(0, Number.isFinite(sharePct) ? sharePct : 0)),
    ...(kitAngle ? { kit_angle: kitAngle } : {}),
    // Re-validé : une valeur hors format serait rejetée par le schéma strict
    // et ferait perdre tout l'événement.
    ...heroMediaTrackingParams(
      heroMedia
        ? { variant: heroMedia.hero_media_variant, level: heroMedia.hero_media_level }
        : null,
    ),
  };
}

let exposureSent = false;

/**
 * Réserve l'émission pour ce chargement de page : `true` la première fois,
 * `false` ensuite.
 */
export function claimKitCheckoutExposure(): boolean {
  if (exposureSent) return false;
  exposureSent = true;
  return true;
}

/** Tests uniquement : simule un nouveau chargement de page. */
export function __resetKitCheckoutExposureForTests(): void {
  exposureSent = false;
}
