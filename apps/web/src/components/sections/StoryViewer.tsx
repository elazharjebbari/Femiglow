'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useReducedMotion } from '@/lib/media/hooks/useReducedMotion';
import { useTracking } from '@/lib/tracking/use-tracking';
import { cn } from '@/lib/utils/cn';
import type { Story, StoriesStrings } from '@/lib/stories/types';

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

/**
 * Viewer plein écran (overlay portal). Monté uniquement à l'ouverture d'une
 * bulle (import dynamique côté orchestrateur). Voir docs/stories-video-2026-08-21/.
 * Durci suite à la revue adversariale : focus-trap + restauration, CTA de repli
 * actif, reset pause à la nav, anti-conflit long-press/swipe, onError + watchdog
 * d'auto-advance, reduced-motion, préchauffe story suivante, story_complete
 * dédupliqué.
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

  const isRtl = () => typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  // CTA effectif (repli si le segment n'en définit pas) — utilisé au rendu ET
  // au clic pour éviter tout bouton mort.
  const activeCta = useMemo(
    () => segment?.cta ?? { label: strings.defaultCta, target: DEFAULT_TARGET },
    [segment?.cta, strings.defaultCta],
  );

  // Montage : portal + verrou de scroll + focus initial + restauration du focus
  // sur la bulle déclencheuse à la fermeture + nettoyage du timer long-press.
  useEffect(() => {
    setMounted(true);
    const trigger = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => overlayRef.current?.focus(), 0);
    const lp = longPressRef; // ref object stable ; on veut le timer COURANT au démontage.
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

  // Changement de segment/story : émet story_view, remet la progression à 0 ET
  // resynchronise l'état pause avec la nouvelle vidéo (autoPlay ou reduced).
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

  // Avance de story SANS émettre story_complete (le complete est géré par next()
  // à la vraie fin) → pas de sur-comptage sur swipe latéral.
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
      // Vraie fin de story → story_complete (dédupliqué).
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

  // Clavier : focus-trap (Tab) + navigation + pause + mute + fermeture.
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

  // Watchdog d'auto-advance : si 'ended' ne se déclenche jamais (source 404 /
  // codec / stall), on avance quand même. Désarmé en pause / reduced-motion.
  useEffect(() => {
    if (!segment || paused || reduce) return;
    const ms = (segment.durationMs > 0 ? segment.durationMs : 8000) + WATCHDOG_BUFFER_MS;
    const t = window.setTimeout(() => next(), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment?.id, paused, reduce]);

  // Long-press = pause tant que maintenu (annulé si le pointeur bouge → swipe).
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

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={story.title}
      tabIndex={-1}
      data-testid="story-viewer"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black outline-none"
    >
      <div
        className="relative h-full w-full max-w-[430px] overflow-hidden bg-black sm:h-[92vh] sm:rounded-2xl"
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

        {/* Préchargement des posters à venir : segment suivant intra-story ET
          1ᵉʳ segment de la story suivante (la vraie transition). */}
        {[nextSegment?.poster, nextStoryFirst?.poster].filter(Boolean).map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src as string} alt="" aria-hidden="true" className="hidden" />
        ))}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent"
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

        {/* Header : titre + play/pause + mute + close. */}
        <div className="absolute inset-x-3 top-7 z-20 flex items-center justify-between">
          <span className="max-w-[52%] truncate text-sm font-medium text-white drop-shadow">
            {story.title}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={togglePause}
              aria-label={paused ? strings.play : strings.pause}
              data-testid="story-playpause"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
            >
              <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
            </button>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? strings.unmute : strings.mute}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
            >
              <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
            </button>
            <button
              type="button"
              onClick={() => closeViewer('button')}
              aria-label={strings.close}
              data-testid="story-close"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ✕
              </span>
            </button>
          </div>
        </div>

        {/* Zones de tap précédent / suivant (miroir RTL via inset logique). */}
        <button
          type="button"
          onClick={guardedTap(prev)}
          aria-label={strings.prevSegment}
          className="absolute inset-y-0 start-0 z-10 w-[30%] cursor-default outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
        />
        <button
          type="button"
          onClick={guardedTap(next)}
          aria-label={strings.nextSegment}
          className="absolute inset-y-0 end-0 z-10 w-[70%] cursor-default outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
        />

        {paused && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <span className="text-5xl text-white/80">▶</span>
          </div>
        )}

        {/* Footer CTA. */}
        <div className="absolute inset-x-4 bottom-4 z-20 flex flex-col gap-2">
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
