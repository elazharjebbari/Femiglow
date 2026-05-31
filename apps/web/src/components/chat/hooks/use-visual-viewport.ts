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
