'use client';

import { GeoPromoSlideHeader } from './GeoPromoSlideHeader';

interface GeoPromoSlideHeaderSlotProps {
  /**
   * Décision SERVEUR (prop `promoBannerEnabled` du layout /kit) : seul l'arbre
   * legacy `(marketing)/kit` l'active. L'arbre localisé `[locale]/kit` — même
   * servi sous l'URL `/kit` par réécriture — ne rend pas le bandeau, comme en
   * production avant la réécriture (le trafic y était redirigé vers `/fr/kit`).
   * On ne se fie pas au pathname : il vaut `/kit` dans les deux cas.
   */
  enabled: boolean;
}

export function GeoPromoSlideHeaderSlot({ enabled }: GeoPromoSlideHeaderSlotProps) {
  if (!enabled) return null;
  return <GeoPromoSlideHeader />;
}
