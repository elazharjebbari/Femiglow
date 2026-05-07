'use client';
import { useEffect, useRef, useState } from 'react';

export interface UseMediaInViewOptions {
  rootMargin?: string;
  threshold?: number | number[];
  once?: boolean;
}

export function useMediaInView<T extends HTMLElement>(
  options: UseMediaInViewOptions = {},
): { ref: React.RefObject<T>; inView: boolean } {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (options.once !== false) observer.disconnect();
          } else if (options.once === false) {
            setInView(false);
          }
        }
      },
      { rootMargin: options.rootMargin ?? '200px', threshold: options.threshold ?? 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [options.once, options.rootMargin, options.threshold]);

  return { ref, inView };
}
