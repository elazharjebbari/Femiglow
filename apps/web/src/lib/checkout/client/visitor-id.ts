/**
 * CHA-230 — Visitor & Session IDs côté client wizard.
 *
 * Le widget chat utilise un cookie HttpOnly `fg_v` pour relier les sessions
 * d'un même navigateur. Le wizard, lui, tourne 100% côté client : on stocke
 * donc visitor + session IDs en `localStorage` (visitor) et `sessionStorage`
 * (session). Ces IDs ne contiennent PAS de PII — ce sont des opaques générés
 * localement.
 *
 * Objectif :
 *   - `visitorId` stable par navigateur (durée 1 an effective via localStorage)
 *   - `sessionId` stable par onglet/tab (sessionStorage, regenerated sur close)
 *
 * Compatibles SSR : les fonctions renvoient `null` quand `window` est absent
 * (rendu serveur), et l'appelant doit toujours appeler `ensureVisitorId()` au
 * mount client pour générer/réhydrater les IDs.
 */
import { createId as createNanoId } from '@/lib/checkout/client/random-id';

const VISITOR_KEY = 'femiglow.wizard.visitor';
const SESSION_KEY = 'femiglow.wizard.session';

/** True si on est côté browser (window + storage disponibles). */
function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined' &&
    typeof window.sessionStorage !== 'undefined'
  );
}

/** Lit ou crée le visitor ID (localStorage). Retourne null si SSR. */
export function ensureVisitorId(): string | null {
  if (!isBrowser()) return null;
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = createNanoId('v');
    window.localStorage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    // localStorage indisponible (mode privé Safari, quota plein, …) — on
    // génère un ID volatile en mémoire pour ne pas casser le wizard.
    return createNanoId('v');
  }
}

/** Lit ou crée le session ID (sessionStorage). Retourne null si SSR. */
export function ensureSessionId(): string | null {
  if (!isBrowser()) return null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = createNanoId('s');
    window.sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return createNanoId('s');
  }
}

/** Reset complet (debug / déconnexion). */
export function resetVisitorAndSession(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(VISITOR_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // no-op
  }
}
