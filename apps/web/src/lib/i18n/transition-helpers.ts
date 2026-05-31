/**
 * Locale Switcher V2 — helpers de transition (lot L2).
 *
 * Petites primitives isolées et testables qui portent la logique
 * INV-critique de la bascule sans reload :
 *  - `getDirection` : sens d'écriture d'une locale (INV-2)
 *  - `applyHtmlLocale` : pose `lang`/`dir` sur `<html>` (INV-2, avant la frame)
 *  - `prefersReducedMotion` : respect de la préférence (INV-7)
 *  - `supportsViewTransitions` : choix du mode de transition
 *  - `announceLocale` : annonce aria-live du changement (INV-10)
 *
 * @see docs/locale-switcher-v2/05-frontend/use-locale-transition.md
 * @see docs/locale-switcher-v2/CONTRACT.md (INV-2, INV-7, INV-10)
 */
import { getLocaleConfig, type Locale } from '@/i18n.config';

/** Région aria-live partagée (montée une fois par `LiveAnnouncer`, lot L3). */
export const LIVE_REGION_ID = 'locale-live-announcer';

/** Sens d'écriture d'une locale (`ar` → `rtl`, sinon `ltr`). */
export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return getLocaleConfig(locale).direction;
}

/**
 * Pose `lang` et `dir` sur `<html>`. Appelé **dans** le callback de
 * transition, avant la nouvelle frame → aucun état LTR visible sur /ar
 * (INV-2). No-op côté serveur.
 */
export function applyHtmlLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.lang = locale;
  html.dir = getDirection(locale);
}

/** `true` si l'utilisateur demande des animations réduites (INV-7). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** `true` si le navigateur expose l'API View Transitions. */
export function supportsViewTransitions(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof (document as { startViewTransition?: unknown }).startViewTransition ===
      'function'
  );
}

/**
 * Annonce le changement de langue au lecteur d'écran (INV-10) via la
 * région aria-live partagée. No-op si la région n'est pas montée ou
 * côté serveur — ne casse jamais le rendu.
 */
export function announceLocale(locale: Locale, label?: string): void {
  if (typeof document === 'undefined') return;
  const region = document.getElementById(LIVE_REGION_ID);
  if (!region) return;
  region.textContent = label ?? getLocaleConfig(locale).displayNameNative;
}
