'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Image } from '@/components/ui/Image';
import { useIdleAfterLoad } from '@/lib/media/hooks/useIdleAfterLoad';
import { useMediaInView } from '@/lib/media/hooks/useMediaInView';
import { allowsUnrequestedMedia, useNetworkInfo } from '@/lib/media/hooks/useNetworkInfo';
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
 * Index de la bulle autorisée à jouer un aperçu animé : la PREMIÈRE bulle
 * visible et non vue qui a une vidéo. `-1` si aucune. Une seule à la fois,
 * pour ne jamais télécharger plusieurs vidéos en parallèle.
 */
export function pickPreviewIndex(
  stories: readonly Story[],
  visible: ReadonlySet<number>,
  seenIds: ReadonlySet<string>,
): number {
  return stories.findIndex(
    (story, index) =>
      visible.has(index) &&
      !seenIds.has(story.id) &&
      (story.segments[0]?.sources.length ?? 0) > 0,
  );
}

/**
 * Une bulle = poster + pastille « play » (on COMPREND que ce sont des vidéos).
 *
 * Kit CRO v2 §1 (vitesse) : AUCUNE vidéo au montage. Le rail décide quelle
 * bulle peut jouer un aperçu (`previewing`) ; seule celle-ci monte un
 * `<video preload="none">` dont les sources ne sont posées qu'à ce moment-là.
 * Le poster reste affiché tant que la vidéo n'a pas réellement démarré.
 */
function StoryBubble({
  story,
  index,
  seen,
  previewing,
  strings,
  onOpen,
  onVisibilityChange,
}: {
  story: Story;
  index: number;
  seen: boolean;
  previewing: boolean;
  strings: StoriesStrings;
  onOpen: (index: number) => void;
  onVisibilityChange: (index: number, inView: boolean) => void;
}) {
  const { ref, inView } = useMediaInView<HTMLSpanElement>({
    rootMargin: '0px',
    threshold: 0.6,
    once: false,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const cover = story.segments[0];

  useEffect(() => {
    onVisibilityChange(index, inView);
  }, [index, inView, onVisibilityChange]);

  useEffect(() => {
    if (!previewing) {
      setPlaying(false);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    // `play()` déclenche le téléchargement (preload="none" jusque-là).
    void v.play().catch(() => setPlaying(false));
    return () => v.pause();
  }, [previewing]);

  return (
    <li className="shrink-0 snap-start">
      <button
        type="button"
        onClick={() => onOpen(index)}
        aria-label={strings.openAria.replace('%title%', story.title)}
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
              {previewing && cover ? (
                <video
                  ref={videoRef}
                  muted
                  loop
                  playsInline
                  preload="none"
                  aria-hidden="true"
                  data-testid={`story-bubble-preview-${story.slug}`}
                  onPlaying={() => setPlaying(true)}
                  className={cn(
                    'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
                    playing ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {cover.sources.map((s) => (
                    <source key={s.url} src={s.url} type={s.mime} />
                  ))}
                </video>
              ) : null}
              {!playing ? (
                // pastille « play » tant qu'aucun aperçu ne tourne → signale la vidéo.
                <span
                  aria-hidden="true"
                  data-testid={`story-bubble-play-${story.slug}`}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/35 pl-0.5 text-[10px] text-white backdrop-blur-[1px]">
                    ▶
                  </span>
                </span>
              ) : null}
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

  // Aperçu animé différé : jamais avant `window.load` + idle, jamais en
  // reduced-motion, jamais en économie de données / réseau ≤ 3G.
  const idleReady = useIdleAfterLoad();
  const reduced = useReducedMotion();
  const network = useNetworkInfo();
  const previewAllowed = idleReady && !reduced && allowsUnrequestedMedia(network);
  const [visible, setVisible] = useState<ReadonlySet<number>>(() => new Set());
  const handleVisibility = useCallback((index: number, inView: boolean) => {
    setVisible((prev) => {
      if (prev.has(index) === inView) return prev;
      const next = new Set(prev);
      if (inView) next.add(index);
      else next.delete(index);
      return next;
    });
  }, []);
  const previewIndex = previewAllowed ? pickPreviewIndex(stories, visible, seenIds) : -1;

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
            previewing={index === previewIndex}
            strings={strings}
            onOpen={onOpen}
            onVisibilityChange={handleVisibility}
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
