'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

import { StoriesRail } from './StoriesRail';
import { getSeenStories, markStorySeen } from '@/lib/stories/seen';
import type { StoriesStrings, StoryFeed } from '@/lib/stories/types';

/**
 * Viewer code-splitté : le bundle + la logique player ne sont téléchargés
 * QU'À la 1ʳᵉ ouverture d'une bulle. Tant que personne n'ouvre de story,
 * aucun JS de player ni aucune vidéo ne charge (payload initial ≈ posters).
 */
const StoryViewer = dynamic(
  () => import('./StoryViewer').then((m) => m.StoryViewer),
  { ssr: false, loading: () => null },
);

interface StoriesVideoProps {
  feed: StoryFeed;
  strings: StoriesStrings;
  /**
   * `section` (défaut) : bande autonome (titre + padding) — placement après le
   * hero sur desktop. `inline` : compact, aligné au conteneur parent (pas de
   * max-w/padding propres, kicker discret) — inséré DANS le hero sur mobile.
   */
  variant?: 'section' | 'inline';
}

export function StoriesVideo({ feed, strings, variant = 'section' }: StoriesVideoProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSeenIds(getSeenStories());
  }, []);

  const onOpen = useCallback((index: number) => setOpenIndex(index), []);
  const onClose = useCallback(() => setOpenIndex(null), []);
  const onStorySeen = useCallback((id: string) => {
    markStorySeen(id);
    setSeenIds((prev) => {
      if (prev.has(id)) return prev;
      const nextSet = new Set(prev);
      nextSet.add(id);
      return nextSet;
    });
  }, []);

  if (feed.stories.length === 0) return null;

  const inline = variant === 'inline';
  // countLabel est déjà résolu (« N vidéos ») par le Bound via next-intl.
  const countText = strings.countLabel;
  const rail = (
    <>
      <StoriesRail
        stories={feed.stories}
        strings={strings}
        seenIds={seenIds}
        onOpen={onOpen}
      />
      {openIndex !== null ? (
        <StoryViewer
          stories={feed.stories}
          strings={strings}
          initialIndex={openIndex}
          onClose={onClose}
          onStorySeen={onStorySeen}
        />
      ) : null}
    </>
  );

  if (inline) {
    // Compact, aligné au conteneur du hero (hérite son padding). Kicker discret.
    return (
      <div aria-label={strings.sectionLabel} data-testid="stories-video" className="w-full">
        <div className="mb-2 flex items-center gap-2">
          {strings.heading ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-encre/45">
              {strings.heading}
            </p>
          ) : null}
          <span className="rounded-full bg-sauge-dark/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sauge-dark">
            {countText}
          </span>
        </div>
        {rail}
      </div>
    );
  }

  return (
    <section
      aria-label={strings.sectionLabel}
      data-testid="stories-video"
      className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8"
    >
      <div className="mb-3 flex items-baseline gap-2.5">
        {strings.heading ? (
          <h2 className="font-display text-lg text-encre sm:text-xl">{strings.heading}</h2>
        ) : null}
        <span className="rounded-full bg-sauge-dark/10 px-2.5 py-1 text-[11px] font-semibold text-sauge-dark">
          {countText}
        </span>
      </div>
      {rail}
    </section>
  );
}
