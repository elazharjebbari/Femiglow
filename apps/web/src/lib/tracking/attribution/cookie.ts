/**
 * Persistance cookie du snapshot d'attribution. Source de vérité
 * côté client (utilisée par TrackingClient pour annoter dataLayer).
 *
 * - Cookie `fg_attr` : first-party, SameSite=Lax, durée 90 jours,
 *   pas httpOnly (le client doit pouvoir lire au moment de l'emit).
 * - Payload = JSON URL-encodé `{ first_touch, last_touch, paid_history }`
 * - Limite ~4KB / cookie : on tronque `paid_history` à 20 entries.
 */
import type {
  AttributionSnapshot,
  ChannelTouch,
} from './types';

export const ATTR_COOKIE_NAME = 'fg_attr';
const COOKIE_TTL_DAYS = 90;
const MAX_PAID_HISTORY = 20;

interface SerializedSnapshot {
  ft: ChannelTouch | null; // first_touch
  lt: ChannelTouch | null; // last_touch
  ph: ChannelTouch[];      // paid_history
  v: 1;                    // schema version
}

function compact(s: AttributionSnapshot): SerializedSnapshot {
  return {
    ft: s.first_touch,
    lt: s.last_touch,
    ph: s.paid_history.slice(0, MAX_PAID_HISTORY),
    v: 1,
  };
}

function expand(s: SerializedSnapshot | null): AttributionSnapshot {
  return {
    first_touch: s?.ft ?? null,
    last_touch: s?.lt ?? null,
    paid_history: s?.ph ?? [],
  };
}

export function readAttributionCookie(): AttributionSnapshot {
  if (typeof document === 'undefined') {
    return { first_touch: null, last_touch: null, paid_history: [] };
  }
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${ATTR_COOKIE_NAME}=`));
  if (!match) return expand(null);
  try {
    const value = decodeURIComponent(match.slice(ATTR_COOKIE_NAME.length + 1));
    return expand(JSON.parse(value) as SerializedSnapshot);
  } catch {
    return expand(null);
  }
}

export function writeAttributionCookie(snapshot: AttributionSnapshot): void {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent(JSON.stringify(compact(snapshot)));
  const maxAge = COOKIE_TTL_DAYS * 24 * 60 * 60;
  document.cookie = `${ATTR_COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

/**
 * Intègre une nouvelle touche dans le snapshot :
 *  - first_touch : préservé si déjà présent
 *  - last_touch : remplacé par la nouvelle
 *  - paid_history : prepend si is_paid + dedup par click_id, LRU 20
 */
export function mergeTouch(
  current: AttributionSnapshot,
  touch: ChannelTouch,
): AttributionSnapshot {
  const first_touch = current.first_touch ?? touch;
  const last_touch = touch;
  let paid_history = current.paid_history;
  if (touch.is_paid) {
    const dedup = paid_history.filter(
      (t) => !(t.click_id && touch.click_id && t.click_id === touch.click_id),
    );
    paid_history = [touch, ...dedup].slice(0, MAX_PAID_HISTORY);
  }
  return { first_touch, last_touch, paid_history };
}
