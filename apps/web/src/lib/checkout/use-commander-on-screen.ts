'use client';

import { useEffect, useState } from 'react';

import { COMMANDER_ANCHOR_ID } from '@/lib/checkout/commander-launcher';

/** La section du formulaire est-elle à l'écran ? `enabled = false` : aucun écouteur. */
export function useCommanderOnScreen(enabled = true): boolean {
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOnScreen(false);
      return;
    }
    const section = document.getElementById(COMMANDER_ANCHOR_ID);
    if (!section || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setOnScreen(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [enabled]);

  return onScreen;
}
