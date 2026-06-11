/**
 * Moteur de suggestion — collecte de signaux DOM/window (lot L10).
 *
 * `collectSignals()` lit des faits **instantanés** du DOM (page courante,
 * focus formulaire, modale/chat, vidéo) et retourne un `Partial<Signals>`.
 * Tout est **conservateur & fail-soft** : côté serveur (pas de `document`)
 * ou en cas d'absence d'info, on n'affirme **jamais** un état permissif —
 * `withSafeDefaults` (L9) comble les trous avec les défauts sûrs (zones
 * calmes à `true`), si bien qu'un signal manquant ne déclenche jamais un
 * `show` par erreur (INV-13/14/17/20).
 *
 * Les métriques **temporelles** (dwell, vélocité de scroll, breakpoint,
 * exit-intent, hover) ne sont PAS lues ici : elles sont accumulées dans le
 * hook runtime `useLocaleSuggestionEngine` et fusionnées avec cette photo.
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/04-frontend/engine-runtime.md
 * @see docs/locale-switcher-v2/CONTRACT.md §7
 */
import { type Signals } from './suggestion-types';

/** Segments de chemin qui dénotent une zone calme « checkout/wizard » (INV-14/5). */
const CHECKOUT_PATH_RE = /(?:^|\/)(?:checkout|commander|wizard|paiement)(?:\/|$)/i;

/** `true` si le chemin appartient au tunnel de commande / wizard. */
export function pathIsCheckout(pathname: string): boolean {
  return CHECKOUT_PATH_RE.test(pathname);
}

/** `true` si l'élément actif est une saisie (input/textarea/select/contenteditable). */
export function isFormElementFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable === true;
}

/** `true` si une modale/chat est ouverte (ne pas empiler de surfaces). */
export function isModalOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.querySelector(
      '[aria-modal="true"],[data-modal-open="true"],[data-chat-open="true"]',
    ) !== null
  );
}

/** `true` si une vidéo est en lecture (immersion média). */
export function isVideoPlaying(): boolean {
  if (typeof document === 'undefined') return false;
  const videos = document.querySelectorAll('video');
  for (const v of Array.from(videos)) {
    const media = v as HTMLVideoElement;
    if (!media.paused && !media.ended && media.currentTime > 0) return true;
  }
  return false;
}

/**
 * Photo instantanée des signaux observables dans le DOM courant.
 *
 * `pathname` est passé en argument (le hook lit `usePathname` de
 * `next/navigation` — chemin brut AVEC locale). Côté serveur, seul le
 * chemin est exploitable ; le reste retombe sur les défauts sûrs en aval.
 */
export function collectSignals(pathname: string): Partial<Signals> {
  const inCheckout = pathIsCheckout(pathname);

  // SSR / pas de DOM : on ne renvoie que ce qui est sûr (le chemin). Les
  // champs absents seront comblés par `withSafeDefaults` (conservateur).
  if (typeof document === 'undefined') {
    return { inCheckout };
  }

  return {
    inCheckout,
    formFocused: isFormElementFocused(),
    modalOpen: isModalOpen(),
    videoPlaying: isVideoPlaying(),
  };
}
