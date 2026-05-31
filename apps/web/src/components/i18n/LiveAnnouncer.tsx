/**
 * Locale Switcher V2 — `LiveAnnouncer` (lot L3).
 *
 * Région `aria-live` unique, montée une fois par le provider. Remplace
 * l'annonce native perdue avec la bascule sans reload (INV-10). Le hook
 * écrit dans cette région via `announceLocale`.
 *
 * @see docs/locale-switcher-v2/CONTRACT.md (INV-10)
 */
'use client';

import { LIVE_REGION_ID } from '@/lib/i18n/transition-helpers';

export function LiveAnnouncer(): JSX.Element {
  return (
    <div
      id={LIVE_REGION_ID}
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="locale-live-announcer"
    />
  );
}
