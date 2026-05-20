/**
 * `NarrativeIntro` — phrase narrative en italique Cormorant qui précède
 * la liste d'ingrédients d'un sous-produit. Compose la « fiche d'atelier »
 * Kolenda §4.5 (voix maison, savoir-faire artisanal Luxury §6).
 *
 * Émet `composition_narrative_view` une seule fois quand l'intro entre
 * dans le viewport au seuil 0.5 (IntersectionObserver). Cleanup à
 * l'unmount.
 */
'use client';

import { useEffect, useRef } from 'react';

import { useTracking } from '@/lib/tracking/use-tracking';

export interface NarrativeIntroProps {
  text: string;
  subProductId: string;
}

export function NarrativeIntro({
  text,
  subProductId,
}: NarrativeIntroProps): JSX.Element {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const { emit } = useTracking();

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }
    let fired = false;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!fired && entry?.isIntersecting) {
          fired = true;
          emit('composition_narrative_view', { sub_product_id: subProductId });
          obs.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [emit, subProductId]);

  return (
    <p
      ref={ref}
      data-testid={`composition-narrative-${subProductId}`}
      className="font-display italic text-encre/75 text-lg leading-[1.55] max-w-prose"
    >
      {text}
    </p>
  );
}
