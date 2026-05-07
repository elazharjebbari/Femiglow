'use client';

import { useEffect, useRef } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';

interface ScrollMilestonesTrackerProps {
  /** Seuils en pourcentage à observer (défaut : 25, 50, 75, 90). */
  thresholds?: number[];
  /** Identifiant du contenu (slug, page) pour la taxonomie. */
  contentId?: string;
  /** Type de contenu (ex. "page", "article", "category"). */
  contentType?: string;
  /** Nom de l'event (défaut : "scroll" — taxonomie GA4 enhanced measurement). */
  eventName?: string;
}

/**
 * @tracking-category engagement
 * @tracking-events scroll
 * @tracking-description Émet `scroll` aux seuils 25/50/75/90 %, une seule fois par seuil par session de page.
 */
export function ScrollMilestonesTracker({
  thresholds = [25, 50, 75, 90],
  contentId,
  contentType = 'page',
  eventName = 'scroll',
}: ScrollMilestonesTrackerProps) {
  const { emit } = useTracking();
  const fired = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sorted = [...thresholds].sort((a, b) => a - b);
    let frame = 0;

    function ratio(): number {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return 1;
      return Math.min(1, Math.max(0, window.scrollY / total));
    }

    function compute(): void {
      const r = ratio() * 100;
      for (const t of sorted) {
        if (r >= t && !fired.current.has(t)) {
          fired.current.add(t);
          emit(eventName, {
            percent_scrolled: t,
            ...(contentId ? { content_id: contentId } : {}),
            ...(contentType ? { content_type: contentType } : {}),
          });
        }
      }
    }

    function onScroll(): void {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        compute();
      });
    }

    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [emit, thresholds, contentId, contentType, eventName]);

  return null;
}
