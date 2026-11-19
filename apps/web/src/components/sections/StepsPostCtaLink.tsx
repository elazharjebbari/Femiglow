/**
 * `StepsPostCtaLink` — bouton de commande sous le mode d'emploi : la
 * visiteuse vient de comprendre le geste, c'est le moment de proposer la
 * commande. Bouton plein (charte `Button` primaire), pleine largeur sur
 * mobile, suivi d'une ligne de réassurance (paiement à la livraison).
 * Émet `pack_steps_cta_click` au clic.
 */
'use client';

import { useCallback } from 'react';

import {
  COMMANDER_ANCHOR_ID,
  getEffectiveCommanderMode,
  openCommander,
} from '@/lib/checkout/commander-launcher';
import { buttonClasses } from '@/components/ui/Button';
import { useTracking } from '@/lib/tracking/use-tracking';

export interface StepsPostCtaLinkProps {
  /** Libellé du bouton (« Commander mon kit »). */
  label: string;
  /** Ancre cible (sans `#`, ex. `commander-femiglow`). */
  anchorId: string;
  /** Réassurance sous le bouton ; rien n'est rendu si absente. */
  note?: string;
}

export function StepsPostCtaLink({
  label,
  anchorId,
  note,
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
    <div className="mx-auto mt-9 max-w-xl text-center">
      <a
        href={`#${anchorId}`}
        onClick={handleClick}
        data-testid="steps-post-cta"
        className={buttonClasses('primary', 'lg', false, 'w-full sm:w-auto sm:min-w-[18rem]')}
      >
        {label}
      </a>
      {note && (
        <p
          data-testid="steps-post-cta-note"
          className="mt-3 font-body text-[13px] leading-[1.5] text-encre-soft"
        >
          {note}
        </p>
      )}
    </div>
  );
}
