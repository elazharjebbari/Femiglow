'use client';

import { useEffect, useRef } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';

interface PromotionTrackerProps {
  /** Identifiant du slot promotionnel (ex. "pivot-banner-rituel"). */
  promotionId: string;
  /** Nom lisible de la promo (ex. "Bandeau pivot — Rituel"). */
  promotionName: string;
  /** Nom du créatif (slogan, version éditoriale). */
  creativeName?: string;
  /** Slot d'emplacement (ex. "home_hero", "journal_footer"). */
  creativeSlot?: string;
  /** Sélecteur de l'élément observé (id). Si absent, le tracker s'auto-attache à son parent. */
  targetId?: string;
  /** Seuil d'intersection (par défaut 0.5). */
  threshold?: number;
}

/**
 * @tracking-category section_promotion
 * @tracking-events view_promotion
 * @tracking-description Émet `view_promotion` (taxonomie GA4) une fois quand le bandeau entre dans le viewport.
 */
export function PromotionTracker({
  promotionId,
  promotionName,
  creativeName,
  creativeSlot,
  targetId,
  threshold = 0.5,
}: PromotionTrackerProps) {
  const { emit } = useTracking();
  const ref = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || fired.current) return;
    const target = targetId
      ? document.getElementById(targetId)
      : ref.current?.parentElement ?? null;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current) {
            fired.current = true;
            emit('view_promotion', {
              promotion_id: promotionId,
              promotion_name: promotionName,
              ...(creativeName ? { creative_name: creativeName } : {}),
              ...(creativeSlot ? { creative_slot: creativeSlot } : {}),
            });
            observer.disconnect();
            break;
          }
        }
      },
      { threshold },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [emit, promotionId, promotionName, creativeName, creativeSlot, targetId, threshold]);

  return <span ref={ref} aria-hidden="true" className="hidden" />;
}
