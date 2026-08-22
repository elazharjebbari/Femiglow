'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Image } from '@/components/ui/Image';
import { useMediaInView } from '@/lib/media/hooks/useMediaInView';
import { useReducedMotion } from '@/lib/media/hooks/useReducedMotion';
import { cn } from '@/lib/utils/cn';
import type { Story, StoriesStrings } from '@/lib/stories/types';

interface StoriesRailProps {
  stories: Story[];
  strings: StoriesStrings;
  seenIds: Set<string>;
  onOpen: (index: number) => void;
}

/**
 * Une bulle = poster + mini-couverture vidéo (muette, en boucle) qui se lance
 * quand la bulle entre dans le viewport → on COMPREND que ce sont des vidéos.
 * Hors-vue / reduced-motion : poster + pastille « play ». La vidéo n'est montée
 * que côté client au scroll (SSR = posters only, payload léger).
 */
function StoryBubble({
  story,
  index,
  seen,
  strings,
  onOpen,
}: {
  story: Story;
  index: number;
  seen: boolean;
  strings: StoriesStrings;
  onOpen: (index: number) => void;
}) {
  const reduced = useReducedMotion();
  const { ref, inView } = useMediaInView<HTMLSpanElement>({
    rootMargin: '150px',
    threshold: 0.25,
    once: false,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cover = story.segments[0];
  const showCover = inView && !reduced && Boolean(cover);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (showCover) void v.play().catch(() => {});
    else v.pause();
  }, [showCover]);

  return (
    <li className="shrink-0 snap-start">
      <button
        type="button"
        onClick={() => onOpen(index)}
        aria-label={strings.openAria.replace('{title}', story.title)}
        data-testid={`story-bubble-${story.slug}`}
        className="group flex w-[84px] flex-col items-center gap-1.5 outline-none"
      >
        <span
          ref={ref}
          className={cn(
            'relative block rounded-full p-[3px] transition-transform group-hover:scale-105',
            'group-focus-visible:ring-2 group-focus-visible:ring-encre group-focus-visible:ring-offset-2',
            seen
              ? 'bg-encre/20'
              : 'bg-gradient-to-tr from-champagne via-terracotta to-sauge-dark',
          )}
        >
          <span className="block rounded-full bg-creme p-[2px]">
            <span className="relative block h-[74px] w-[74px] overflow-hidden rounded-full bg-encre/5">
              <Image
                src={story.bubblePoster}
                alt=""
                width={180}
                height={180}
                ratio="1:1"
                sizes="84px"
                loading={index < 4 ? 'eager' : 'lazy'}
              />
              {showCover ? (
                <video
                  ref={videoRef}
                  muted
                  loop
                  playsInline
                  autoPlay
                  preload="metadata"
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover"
                >
                  {cover!.sources.map((s) => (
                    <source key={s.url} src={s.url} type={s.mime} />
                  ))}
                </video>
              ) : (
                // pastille « play » quand la couverture ne tourne pas → signale la vidéo.
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/35 pl-0.5 text-[10px] text-white backdrop-blur-[1px]">
                    ▶
                  </span>
                </span>
              )}
              {seen ? (
                <span aria-hidden="true" className="absolute inset-0 bg-encre/30" />
              ) : null}
            </span>
          </span>

          {/* badge « déjà vu » — coche discrète en surimpression. */}
          {seen ? (
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -end-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-creme bg-sauge-dark text-[10px] font-bold text-creme"
            >
              ✓
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            'line-clamp-2 max-w-[86px] text-center text-[11px] leading-tight',
            seen ? 'text-encre/50' : 'text-encre/80',
          )}
        >
          {story.title}
        </span>
      </button>
    </li>
  );
}

/**
 * Rail de bulles — TOUJOURS sur une ligne, défilable horizontalement, avec une
 * affordance de scroll explicite (peek + dégradé de bord + chevron + indice),
 * miroir en RTL. Voir docs/stories-video-2026-08-21/.
 */
export function StoriesRail({ stories, strings, seenIds, onOpen }: StoriesRailProps) {
  const scrollRef = useRef<HTMLUListElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
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
        {stories.map((story, index) => (
          <StoryBubble
            key={story.id}
            story={story}
            index={index}
            seen={seenIds.has(story.id)}
            strings={strings}
            onOpen={onOpen}
          />
        ))}
      </ul>

      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 start-0 w-8 bg-gradient-to-r from-creme to-transparent rtl:bg-gradient-to-l',
          'transition-opacity duration-200',
          atStart ? 'opacity-0' : 'opacity-100',
        )}
      />
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
          'absolute end-1 top-[32px] hidden h-8 w-8 items-center justify-center rounded-full bg-creme/95 text-encre shadow-md ring-1 ring-encre/10 transition-opacity duration-200 hover:bg-creme md:flex',
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

      {!atEnd ? (
        <p className="mt-1 select-none text-center text-[10px] uppercase tracking-[0.16em] text-encre/40 motion-safe:animate-pulse">
          {strings.scrollHint}
        </p>
      ) : null}
    </div>
  );
}
