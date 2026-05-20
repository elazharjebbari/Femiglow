/**
 * `VideoPostCta` — lien éditorial qui suit la transcription et invite à
 * descendre vers la section pack (`#commander-femiglow`).
 *
 * Kolenda §4.4 :
 *  - Pas de bouton primary surdimensionné ici — la vraie CTA est plus bas.
 *    On veut juste guider l'œil vers la suite, en restant chuchoté.
 *  - Texte court, flèche bas décorative, scroll smooth natif.
 *  - Click émet `video_cta_click` (catégorie « engagement »).
 *
 * cf. docs/video-gestes-optim-2026-05/05-frontend-public-design.md §7
 */
'use client';

import { useCallback } from 'react';

import { useTracking } from '@/lib/tracking/use-tracking';

export interface VideoPostCtaProps {
  /** Ancre cible (par défaut `#commander-femiglow`). */
  href?: string;
  /** ID stable pour le tracking. */
  videoId: string;
  /** Texte du lien (par défaut « Voir le pack ci-dessous »). */
  label?: string;
}

export function VideoPostCta({
  href = '#commander-femiglow',
  videoId,
  label = 'Voir le pack ci-dessous',
}: VideoPostCtaProps): JSX.Element {
  const { emit } = useTracking();

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      emit('video_cta_click', {
        video_id: videoId,
        cta_label: label,
        cta_target: href,
      });
      // Scroll smooth si on cible une ancre interne. On laisse le browser
      // gérer le défilement natif si possible, sinon fallback JS.
      if (href.startsWith('#')) {
        const target = document.getElementById(href.slice(1));
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [emit, href, label, videoId],
  );

  return (
    <div className="mt-4 text-center">
      <a
        href={href}
        onClick={handleClick}
        data-testid="video-post-cta"
        className="inline-flex items-center gap-1 pt-1 font-body text-[12px] uppercase tracking-[0.18em] text-encre underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A876] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E8EDE3]"
      >
        {label} <span aria-hidden="true">↓</span>
      </a>
    </div>
  );
}
