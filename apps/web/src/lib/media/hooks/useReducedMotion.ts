'use client';
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function read(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => read());
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const handler = () => setReduced(mql.matches);
    handler();
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);
  return reduced;
}
