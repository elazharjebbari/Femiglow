'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useReducedMotion } from '@/lib/media/hooks/useReducedMotion';
import { useTracking } from '@/lib/tracking/use-tracking';
import { cn } from '@/lib/utils/cn';
import type { Story, StoriesStrings, StorySegment } from '@/lib/stories/types';

interface StoryViewerProps {
  stories: Story[];
  strings: StoriesStrings;
  initialIndex: number;
  onClose: () => void;
  onStorySeen: (storyId: string) => void;
}

const SWIPE_THRESHOLD = 60;
const LONG_PRESS_MS = 220;
const MOVE_CANCEL_PX = 10;
const WATCHDOG_BUFFER_MS = 4000;
const DEFAULT_TARGET = '#commander-femiglow';

function Chevron({ dir }: { dir: 'prev' | 'next' }) {
  // Base « › » (pointe à droite). next : droite en LTR, gauche en RTL.
  // prev : gauche en LTR, droite en RTL. Rotations non ambiguës (0 vs 180).
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('h-6 w-6', dir === 'prev' ? 'rotate-180 rtl:rotate-0' : 'rtl:rotate-180')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/**
 * Viewer plein écran (overlay portal, z très haut → recouvre le menu du site).
 * Monté uniquement à l'ouverture d'une bulle. Voir docs/stories-video-2026-08-21/.
 * Durci (revue adversariale) : focus-trap + restore, CTA repli actif, reset pause
 * nav, anti-conflit long-press/swipe, onError + watchdog, reduced-motion, préchauffe
 * de la vidéo suivante, story_complete dédupliqué. Contrôles visibles : flèches
 * prev/next + bouton quitter proéminent.
 */
export function StoryViewer({
  stories,
  strings,
  initialIndex,
  onClose,
  onStorySeen,
}: StoryViewerProps) {
  const { emit } = useTracking();
  const reduce = useReducedMotion();
  const [storyIndex, setStoryIndex] = useState(initialIndex);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const longPressRef = useRef<{ timer: number | null; fired: boolean; x: number; y: number }>({
    timer: null,
    fired: false,
    x: 0,
    y: 0,
  });
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const completedRef = useRef<Set<string>>(new Set());

  const story = stories[storyIndex];
  const segment = story?.segments[segmentIndex];
  const nextSegment = story?.segments[segmentIndex + 1];
  const nextStoryFirst = stories[storyIndex + 1]?.segments[0];
  // Vidéo à préchauffer : segment suivant intra-story, sinon 1ᵉʳ de la story suivante.
  const preloadNext: StorySegment | undefined = nextSegment ?? nextStoryFirst;

  const isRtl = () => typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  const activeCta = useMemo(
    () => segment?.cta ?? { label: strings.defaultCta, target: DEFAULT_TARGET },
    [segment?.cta, strings.defaultCta],
  );

  useEffect(() => {
    setMounted(true);
    const trigger = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => overlayRef.current?.focus(), 0);
    const lp = longPressRef;
    return () => {
      document.body.style.overflow = prevOverflow;
      clearTimeout(focusTimer);
      if (lp.current.timer) clearTimeout(lp.current.timer);
      trigger?.focus?.();
    };
  }, []);

  const closeViewer = useCallback(
    (reason: string) => {
      if (story) emit('story_close', { story_id: story.id, segment_index: segmentIndex, reason });
      onClose();
    },
    [emit, onClose, story, segmentIndex],
  );

  const openedRef = useRef(false);
  useEffect(() => {
    if (!story) return;
    if (!openedRef.current) {
      openedRef.current = true;
      emit('story_open', { story_id: story.id, entry: 'bubble', story_index: storyIndex });
    }
    onStorySeen(story.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id]);

  useEffect(() => {
    if (story && segment) {
      emit('story_view', { story_id: story.id, segment_id: segment.id, segment_index: segmentIndex });
      setProgress(0);
      setPaused(reduce);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, segment?.id]);

  const goPrevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
      setSegmentIndex(0);
    }
  }, [storyIndex]);

  const goNextStory = useCallback(() => {
    if (storyIndex < stories.length - 1) {
      setStoryIndex((i) => i + 1);
      setSegmentIndex(0);
    } else {
      closeViewer('end');
    }
  }, [storyIndex, stories.length, closeViewer]);

  const next = useCallback(() => {
    if (!story) return;
    if (segmentIndex < story.segments.length - 1) {
      emit('story_next', { story_id: story.id, segment_index: segmentIndex + 1 });
      setSegmentIndex((i) => i + 1);
    } else {
      if (!completedRef.current.has(story.id)) {
        completedRef.current.add(story.id);
        emit('story_complete', { story_id: story.id });
      }
      goNextStory();
    }
  }, [emit, story, segmentIndex, goNextStory]);

  const prev = useCallback(() => {
    if (!story) return;
    if (segmentIndex > 0) {
      emit('story_prev', { story_id: story.id, segment_index: segmentIndex - 1 });
      setSegmentIndex((i) => i - 1);
    } else {
      goPrevStory();
    }
  }, [emit, story, segmentIndex, goPrevStory]);

  const togglePause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
      if (story && segment) emit('story_pause', { story_id: story.id, segment_id: segment.id });
    }
  }, [emit, story, segment]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const rtl = isRtl();
      const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
      const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === 'Tab') {
        const root = overlayRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null || el === root);
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const activeEl = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (activeEl === first || !root.contains(activeEl))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && activeEl === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (e.key === 'Escape') closeViewer('escape');
      else if (e.key === forward) next();
      else if (e.key === backward) prev();
      else if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      } else if (e.key.toLowerCase() === 'm') setMuted((m) => !m);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, togglePause, closeViewer]);

  useEffect(() => {
    if (!segment || paused || reduce) return;
    const ms = (segment.durationMs > 0 ? segment.durationMs : 8000) + WATCHDOG_BUFFER_MS;
    const t = window.setTimeout(() => next(), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment?.id, paused, reduce]);

  const onPressStart = useCallback(
    (e: React.PointerEvent) => {
      longPressRef.current.fired = false;
      longPressRef.current.x = e.clientX;
      longPressRef.current.y = e.clientY;
      longPressRef.current.timer = window.setTimeout(() => {
        longPressRef.current.fired = true;
        const v = videoRef.current;
        if (v && !v.paused) {
          v.pause();
          setPaused(true);
          if (story && segment) emit('story_pause', { story_id: story.id, segment_id: segment.id });
        }
      }, LONG_PRESS_MS);
    },
    [emit, story, segment],
  );

  const onPressMove = useCallback((e: React.PointerEvent) => {
    const s = longPressRef.current;
    if (!s.timer) return;
    if (Math.abs(e.clientX - s.x) > MOVE_CANCEL_PX || Math.abs(e.clientY - s.y) > MOVE_CANCEL_PX) {
      clearTimeout(s.timer);
      s.timer = null;
    }
  }, []);

  const onPressEnd = useCallback(() => {
    if (longPressRef.current.timer) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
    if (longPressRef.current.fired) {
      const v = videoRef.current;
      if (v) void v.play().catch(() => {});
      setPaused(false);
    }
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    const t = e.changedTouches[0];
    touchRef.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dy > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
      closeViewer('swipe_down');
    } else if (Math.abs(dx) > SWIPE_THRESHOLD) {
      const forward = isRtl() ? dx > 0 : dx < 0;
      if (forward) goNextStory();
      else goPrevStory();
    }
  };

  const guardedTap = (fn: () => void) => () => {
    if (longPressRef.current.fired) return;
    fn();
  };

  const onCtaClick = useCallback(() => {
    if (!story || !segment) return;
    emit('story_cta_click', {
      story_id: story.id,
      segment_id: segment.id,
      cta_target: activeCta.target,
    });
    onClose();
    if (activeCta.target.startsWith('#')) {
      const el = document.getElementById(activeCta.target.slice(1));
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    } else {
      window.location.href = activeCta.target;
    }
  }, [emit, story, segment, activeCta, onClose]);

  if (!mounted || !story || !segment) return null;

  const iconBtn =
    'flex items-center justify-center rounded-full text-white outline-none transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white';

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={story.title}
      tabIndex={-1}
      data-testid="story-viewer"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 outline-none"
    >
      <div
        className="relative h-full w-full max-w-[440px] overflow-hidden bg-black sm:h-[94vh] sm:rounded-2xl"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPressStart}
        onPointerMove={onPressMove}
        onPointerUp={onPressEnd}
        onPointerLeave={onPressEnd}
      >
        <video
          key={segment.id}
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          poster={segment.poster}
          autoPlay={!reduce}
          muted={muted}
          playsInline
          preload="auto"
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration > 0) setProgress(v.currentTime / v.duration);
          }}
          onEnded={next}
          onError={next}
        >
          {segment.sources.map((s) => (
            <source key={s.url} src={s.url} type={s.mime} />
          ))}
        </video>

        {/* Préchauffe de la vidéo suivante (buffering anticipé → transition rapide). */}
        {preloadNext ? (
          <video
            key={`preload-${preloadNext.id}`}
            muted
            preload="auto"
            playsInline
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none absolute h-px w-px opacity-0"
          >
            {preloadNext.sources.map((s) => (
              <source key={s.url} src={s.url} type={s.mime} />
            ))}
          </video>
        ) : null}
        {/* Poster suivant préchargé aussi. */}
        {preloadNext ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preloadNext.poster} alt="" aria-hidden="true" className="hidden" />
        ) : null}

        {/* Voiles pour lisibilité. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 to-transparent"
        />

        {/* Barres de progression segmentées. */}
        <div className="absolute inset-x-3 top-3 z-20 flex gap-1.5">
          {story.segments.map((seg, i) => (
            <div
              key={seg.id}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={i < segmentIndex ? 100 : i === segmentIndex ? Math.round(progress * 100) : 0}
              aria-label={strings.segmentProgress
                .replace('{index}', String(i + 1))
                .replace('{total}', String(story.segments.length))}
              className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <span
                className="block h-full rounded-full bg-white"
                style={{
                  width: `${i < segmentIndex ? 100 : i === segmentIndex ? progress * 100 : 0}%`,
                  transition: i === segmentIndex ? 'width 120ms linear' : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* Header : titre + play/pause + mute + QUITTER (proéminent). */}
        <div className="absolute inset-x-3 top-7 z-30 flex items-center justify-between">
          <span className="max-w-[48%] truncate text-sm font-medium text-white drop-shadow">
            {story.title}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePause}
              aria-label={paused ? strings.play : strings.pause}
              data-testid="story-playpause"
              className={cn(iconBtn, 'h-9 w-9 text-white/90')}
            >
              <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? strings.unmute : strings.mute}
              className={cn(iconBtn, 'h-9 w-9 text-white/90')}
            >
              <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
            </button>
            <button
              type="button"
              onClick={() => closeViewer('button')}
              aria-label={strings.close}
              data-testid="story-close"
              className={cn(iconBtn, 'h-11 w-11 bg-white/15 text-white ring-1 ring-white/25')}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Zones de tap invisibles (nav rapide façon stories). */}
        <button
          type="button"
          onClick={guardedTap(prev)}
          aria-label={strings.prevSegment}
          tabIndex={-1}
          className="absolute inset-y-0 start-0 z-10 w-[32%] cursor-default outline-none"
        />
        <button
          type="button"
          onClick={guardedTap(next)}
          aria-label={strings.nextSegment}
          tabIndex={-1}
          className="absolute inset-y-0 end-0 z-10 w-[68%] cursor-default outline-none"
        />

        {/* Flèches visibles minimalistes et élégantes. */}
        <button
          type="button"
          onClick={guardedTap(prev)}
          aria-label={strings.prevSegment}
          className={cn(
            iconBtn,
            'absolute start-2 top-1/2 z-30 h-11 w-11 -translate-y-1/2 bg-white/10 backdrop-blur-sm hover:bg-white/25',
          )}
        >
          <Chevron dir="prev" />
        </button>
        <button
          type="button"
          onClick={guardedTap(next)}
          aria-label={strings.nextSegment}
          className={cn(
            iconBtn,
            'absolute end-2 top-1/2 z-30 h-11 w-11 -translate-y-1/2 bg-white/10 backdrop-blur-sm hover:bg-white/25',
          )}
        >
          <Chevron dir="next" />
        </button>

        {paused ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <span className="text-5xl text-white/70">▶</span>
          </div>
        ) : null}

        {/* Footer CTA. */}
        <div className="absolute inset-x-4 bottom-4 z-30 flex flex-col gap-2">
          {segment.caption ? (
            <p className="text-center text-sm text-white/90 drop-shadow">{segment.caption}</p>
          ) : null}
          <button
            type="button"
            onClick={onCtaClick}
            data-testid="story-cta"
            className={cn(
              'w-full rounded-full bg-creme px-6 py-3 text-center text-sm font-semibold text-encre shadow-lg outline-none',
              'transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-white motion-safe:animate-soft-pulse',
            )}
          >
            {activeCta.label}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
