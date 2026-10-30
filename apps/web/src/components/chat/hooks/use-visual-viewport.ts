/**
 * CHA-mobile-ux — `useVisualViewportHeight`.
 *
 * Retourne la hauteur de la viewport **visuelle** (i.e. en mobile,
 * l'écran moins le clavier virtuel). Fallback `window.innerHeight`
 * pour les navigateurs sans `visualViewport` API (rare en 2026, mais
 * safe).
 *
 * Usage prévu (v2) : permettre à `ChatPanel` d'ajuster sa hauteur
 * live quand le clavier iOS apparaît / disparaît, dans les cas où
 * `100dvh` + `interactiveWidget: 'resizes-content'` ne suffisent pas
 * (certaines combinaisons iOS 16 / WKWebView).
 *
 * Pour la v1 le hook n'est PAS branché dans `ChatPanel` (la combo
 * `100dvh` + viewport hint couvre 95 % des cas). On le livre pour
 * éviter une seconde PR si on doit ajuster en prod.
 *
 * cf. docs/chat-assistant/21-mobile-ux-plan.md §2.2 F6
 */
'use client';

import { useEffect, useState } from 'react';

export function useVisualViewportHeight(): number | null {
  const [h, setH] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const read = (): void => {
      setH(vv?.height ?? window.innerHeight);
    };
    read();
    if (vv) {
      vv.addEventListener('resize', read);
      vv.addEventListener('scroll', read);
      return () => {
        vv.removeEventListener('resize', read);
        vv.removeEventListener('scroll', read);
      };
    }
    // Fallback : on écoute `window.resize` pour les browsers sans VV.
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  return h;
}

/**
 * Kit CRO v2 §2 — Hauteur masquée en bas par le clavier virtuel (px), ou `0`.
 *
 * Même calcul que `ChatPanel` (`innerHeight − visualViewport.height −
 * offsetTop`) : sur iOS, le clavier ne réduit pas `innerHeight`, un panneau
 * `position: fixed` ancré en bas passerait dessous. Le consommateur applique
 * la valeur en `padding-bottom` pour garder le champ actif visible.
 *
 * `enabled = false` → aucun écouteur (panneau fermé).
 */
export function useVisualViewportKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    let rafId = 0;
    const read = (): void => {
      setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    };
    const onChange = (): void => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(read);
    };
    read();
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    return () => {
      window.cancelAnimationFrame(rafId);
      vv.removeEventListener('resize', onChange);
      vv.removeEventListener('scroll', onChange);
      setInset(0);
    };
  }, [enabled]);

  return inset;
}
