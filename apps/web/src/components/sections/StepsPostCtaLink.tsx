/**
 * `StepsPostCtaLink` — lien éditorial chuchoté sous la grille des
 * 4 gestes (Kolenda §4.7 Attention #12 — directional cues).
 *
 * Style : aligné sur `PostCtaLink` (section composition `/kit`) —
 * uppercase tracking-wide, soulignement focus-visible, no surface
 * decoration. Émet `pack_steps_cta_click` au clic.
 */
'use client';

import { useCallback } from 'react';

import {
  COMMANDER_ANCHOR_ID,
  getEffectiveCommanderMode,
  openCommander,
} from '@/lib/checkout/commander-launcher';
import { useTracking } from '@/lib/tracking/use-tracking';

export interface StepsPostCtaLinkProps {
  /** Libellé du lien (« Démarrer le rituel »). */
  label: string;
  /** Ancre cible (sans `#`, ex. `commander-femiglow`). */
  anchorId: string;
}

export function StepsPostCtaLink({
  label,
  anchorId,
}: StepsPostCtaLinkProps): JSX.Element {
  const { emit } = useTracking();

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      const toCommander = anchorId === COMMANDER_ANCHOR_ID;
      emit('pack_steps_cta_click', {
        cta_target: `#${anchorId}`,
        ...(toCommander ? { kit_cta_mode: getEffectiveCommanderMode() } : {}),
      });
      const target =
        typeof document !== 'undefined'
          ? document.getElementById(anchorId)
          : null;
      if (!target) return;
      event.preventDefault();
      // Ancre du formulaire : `openCommander` (défilement centré ou panneau).
      if (toCommander) openCommander({ source: 'steps_post_cta' });
      else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [emit, anchorId],
  );

  return (
    <div className="mt-12 text-center">
      <a
        href={`#${anchorId}`}
        onClick={handleClick}
        data-testid="steps-post-cta"
        className="inline-flex items-center gap-1 pt-1 font-body text-[12px] uppercase tracking-[0.18em] text-encre/70 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A876] focus-visible:ring-offset-2 focus-visible:ring-offset-creme"
      >
        {label}
        <span aria-hidden="true">↓</span>
      </a>
    </div>
  );
}
