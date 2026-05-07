'use client';

import { useEffect, useRef } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';

interface ScrollDepthTrackerProps {
  /** Sélecteur ou id de l'élément à observer (défaut : window scroll). */
  targetId?: string;
  /** Nom de l'event scroll standard à émettre quand le seuil 75 % est franchi. */
  eventName?: string;
  /** Identifiant du contenu (slug article, etc.) — passé en payload. */
  contentId?: string;
  /** Type de contenu pour la taxonomie (article, page). */
  contentType?: string;
}

/**
 * @tracking-category section_content
 * @tracking-events scroll, journal_read_75
 * @tracking-description Émet `journal_read_75` (ou eventName) une fois quand l'utilisateur a lu ≥ 75 % du contenu.
 *   Idempotence : un seul tir par tuple (contentId, eventName) — si le contentId change (navigation vers
 *   un autre article), la flag est ré-armée. cf. docs/analytics/03-events-funnel-audit.md §6.3.
 */
export function ScrollDepthTracker({
  targetId,
  eventName = 'journal_read_75',
  contentId,
  contentType = 'article',
}: ScrollDepthTrackerProps) {
  const { emit } = useTracking();
  const fired = useRef(false);
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `${eventName}::${contentId ?? ''}`;
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key;
      fired.current = false;
    }
    const target = targetId ? document.getElementById(targetId) : null;
    let frame = 0;

    function compute(): number {
      if (target) {
        const rect = target.getBoundingClientRect();
        const total = target.scrollHeight - window.innerHeight;
        const scrolled = -rect.top;
        if (total <= 0) return 1;
        return Math.min(1, Math.max(0, scrolled / total));
      }
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return 1;
      return Math.min(1, Math.max(0, window.scrollY / total));
    }

    function check(): void {
      if (fired.current) return;
      const ratio = compute();
      if (ratio >= 0.75) {
        fired.current = true;
        emit(eventName, {
          percent_scrolled: 75,
          content_id: contentId,
          content_type: contentType,
        });
      }
    }

    function onScroll(): void {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        check();
      });
    }

    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [emit, eventName, targetId, contentId, contentType]);

  return null;
}
