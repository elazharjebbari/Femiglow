'use client';

import { useEffect, useState } from 'react';

/**
 * Détecte la préférence utilisateur `prefers-reduced-motion: reduce`.
 *
 * Retourne `false` au premier render (SSR-safe) puis `true`/`false`
 * selon la media query. Le re-render se fait quand l'utilisateur change
 * sa préférence système.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent): void => setReduced(e.matches);
    // Safari < 14 ne supporte que addListener (deprecated mais nécessaire)
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, []);

  return reduced;
}
