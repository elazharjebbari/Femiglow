'use client';

import { useCallback, useState } from 'react';

export interface UseGalleryParams {
  count: number;
  initialIndex?: number;
}

export interface UseGalleryReturn {
  currentIndex: number;
  setIndex: (i: number) => void;
  next: () => void;
  prev: () => void;
}

/**
 * Hook de pilotage d'une galerie d'images.
 *
 * Garanties :
 *  - `currentIndex` est toujours dans [0, count-1] ou 0 si count=0.
 *  - `setIndex` wrap les valeurs hors borne (cyclic).
 *  - `next` et `prev` wrap aux extrémités.
 *
 * Le hook ne touche pas au DOM — l'orchestrateur (`HeroGallery`) connecte
 * l'index à des side-effects (scroll, focus, animation).
 */
export function useGallery({ count, initialIndex = 0 }: UseGalleryParams): UseGalleryReturn {
  const [currentIndex, setCurrentIndex] = useState(() => clamp(initialIndex, count));

  const setIndex = useCallback(
    (i: number) => {
      if (count <= 0) return;
      setCurrentIndex(wrap(i, count));
    },
    [count],
  );

  const next = useCallback(() => {
    if (count <= 0) return;
    setCurrentIndex((idx) => wrap(idx + 1, count));
  }, [count]);

  const prev = useCallback(() => {
    if (count <= 0) return;
    setCurrentIndex((idx) => wrap(idx - 1, count));
  }, [count]);

  return { currentIndex, setIndex, next, prev };
}

function wrap(value: number, count: number): number {
  if (count <= 0) return 0;
  return ((value % count) + count) % count;
}

function clamp(value: number, count: number): number {
  if (count <= 0) return 0;
  if (value < 0) return 0;
  if (value > count - 1) return count - 1;
  return value;
}
