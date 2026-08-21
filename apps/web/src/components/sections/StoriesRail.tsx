'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Image } from '@/components/ui/Image';
import { cn } from '@/lib/utils/cn';
import type { Story, StoriesStrings } from '@/lib/stories/types';

interface StoriesRailProps {
  stories: Story[];
  strings: StoriesStrings;
  seenIds: Set<string>;
  onOpen: (index: number) => void;
}

/**
 * Rail de bulles — TOUJOURS sur une ligne, défilable horizontalement, avec
 * une affordance de scroll explicite :
 *  - la bulle suivante « dépasse » (peek) grâce aux largeurs fixes + overflow ;
 *  - un dégradé de bord + un chevron apparaissent côté « suite » quand il reste
 *    du contenu (masqués si tout tient à l'écran) ;
 *  - la scrollbar est masquée pour un rendu propre.
 * Direction lue au runtime (RTL arabe) : bords/chevron/scroll miroir.
 */
export function StoriesRail({ stories, strings, seenIds, onOpen }: StoriesRailProps) {
  const scrollRef = useRef<HTMLUListElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // scrollLeft peut être négatif en RTL (navigateurs modernes) → abs.
    const cur = Math.abs(el.scrollLeft);
    setAtStart(cur <= 4);
    setAtEnd(cur >= max - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    const onResize = () => updateEdges();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateEdges, stories.length]);

  const scrollForward = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Direction lue à l'instant du clic → robuste au switch de langue à chaud.
    const rtl = getComputedStyle(el).direction === 'rtl';
    const amount = Math.round(el.clientWidth * 0.8);
    el.scrollBy({ left: rtl ? -amount : amount, behavior: 'smooth' });
  }, []);

  if (stories.length === 0) return null;

  return (
    <div className="relative">
      <ul
        ref={scrollRef}
        role="list"
        aria-label={strings.sectionLabel}
        tabIndex={0}
        onScroll={updateEdges}
        className={cn(
          'flex gap-4 overflow-x-auto scroll-smooth px-1 pb-2 pt-1',
          'snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre',
        )}
      >
        {stories.map((story, index) => {
          const seen = seenIds.has(story.id);
          return (
            <li key={story.id} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onOpen(index)}
                aria-label={strings.openAria.replace('{title}', story.title)}
                data-testid={`story-bubble-${story.slug}`}
                className="group flex w-[76px] flex-col items-center gap-1.5 outline-none"
              >
                <span
                  className={cn(
                    'relative block rounded-full p-[3px] transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-encre group-focus-visible:ring-offset-2',
                    seen
                      ? 'bg-encre/15'
                      : 'bg-gradient-to-tr from-champagne via-terracotta to-sauge-dark',
                  )}
                >
                  <span className="block rounded-full bg-creme p-[2px]">
                    <span className="block h-[68px] w-[68px] overflow-hidden rounded-full bg-encre/5">
                      <Image
                        src={story.bubblePoster}
                        alt=""
                        width={160}
                        height={160}
                        ratio="1:1"
                        sizes="76px"
                        loading={index < 4 ? 'eager' : 'lazy'}
                      />
                    </span>
                  </span>
                </span>
                <span className="line-clamp-2 max-w-[80px] text-center text-[11px] leading-tight text-encre/80">
                  {story.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Dégradé de bord côté « début » (visible dès qu'on a défilé). */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 start-0 w-8 bg-gradient-to-r from-creme to-transparent rtl:bg-gradient-to-l',
          'transition-opacity duration-200',
          atStart ? 'opacity-0' : 'opacity-100',
        )}
      />

      {/* Dégradé + chevron côté « suite » (la où il reste des vidéos). */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 end-0 w-12 bg-gradient-to-l from-creme to-transparent rtl:bg-gradient-to-r',
          'transition-opacity duration-200',
          atEnd ? 'opacity-0' : 'opacity-100',
        )}
      />
      <button
        type="button"
        onClick={scrollForward}
        aria-label={strings.scrollMore}
        tabIndex={-1}
        className={cn(
          'absolute end-1 top-[30px] hidden h-8 w-8 items-center justify-center rounded-full bg-creme/90 text-encre shadow-md ring-1 ring-encre/10 transition-opacity duration-200 hover:bg-creme md:flex',
          atEnd ? 'pointer-events-none opacity-0' : 'opacity-100',
        )}
      >
        <span aria-hidden="true" className="text-lg leading-none rtl:hidden">
          ›
        </span>
        <span aria-hidden="true" className="hidden text-lg leading-none rtl:inline">
          ‹
        </span>
      </button>

      {/* Indice textuel discret, seulement s'il reste du contenu. */}
      {!atEnd && (
        <p className="mt-1 select-none text-center text-[10px] uppercase tracking-[0.16em] text-encre/40 motion-safe:animate-pulse">
          {strings.scrollHint}
        </p>
      )}
    </div>
  );
}
