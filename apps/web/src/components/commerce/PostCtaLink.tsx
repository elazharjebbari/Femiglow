/**
 * `PostCtaLink` — lien éditorial réutilisable « ↓ Voir le pack » qui suit
 * une sous-section (sous-produit, transcription vidéo, etc.) et invite à
 * descendre vers le bloc pack `#commander-femiglow`.
 *
 * Kolenda :
 *  - Attention §12 — directional words (« ↓ Voir le pack ci-dessous »)
 *  - Pas de bouton primary surdimensionné ici, juste un lien chuchoté
 *  - Click émet `composition_post_cta_click` (catégorie engagement)
 *  - Scroll smooth natif si l'ancre cible existe
 *
 * cf. docs/ingredients-detail-optim-2026-05/05-frontend-public-design.md §8
 */
'use client';

import { useCallback } from 'react';

import { useTracking } from '@/lib/tracking/use-tracking';

export interface PostCtaLinkProps {
  /** ID stable du sous-produit (ou autre contexte) pour le tracking. */
  subProductId: string;
  /** Ancre cible (par défaut `#commander-femiglow`). */
  href?: string;
  /** Texte du lien (par défaut « Voir le pack »). */
  label?: string;
}

export function PostCtaLink({
  subProductId,
  href = '#commander-femiglow',
  label = 'Voir le pack',
}: PostCtaLinkProps): JSX.Element {
  const { emit } = useTracking();

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      emit('composition_post_cta_click', {
        sub_product_id: subProductId,
        cta_target: href,
      });
      if (href.startsWith('#')) {
        const target = document.getElementById(href.slice(1));
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [emit, href, subProductId],
  );

  return (
    <div className="mt-4 text-right">
      <a
        href={href}
        onClick={handleClick}
        data-testid={`composition-post-cta-${subProductId}`}
        className="inline-flex items-center gap-1 pt-1 font-body text-[12px] uppercase tracking-[0.18em] text-encre/70 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A876] focus-visible:ring-offset-2 focus-visible:ring-offset-creme-warm"
      >
        {label} <span aria-hidden="true">↓</span>
      </a>
    </div>
  );
}
