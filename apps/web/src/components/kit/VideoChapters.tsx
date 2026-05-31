/**
 * `VideoChapters` — mini-timeline cliquable sous la vidéo (Kolenda §4.4).
 *
 *  - Une `<nav aria-label="Chapitres de la vidéo">` qui rend les chapitres
 *    en 4 colonnes mobile / 4 colonnes desktop. Chaque chapitre est un
 *    `<button type="button">` discret (numéro `01` + label + timestamp).
 *  - Le chapitre actif porte `aria-current="step"` + underline accent.
 *  - Click → callback `onSeek(startSeconds)` + tracking `video_chapter_click`.
 *  - Rétrocompat : si `chapters` absent ou `chapters.length < 2`, le composant
 *    ne rend RIEN (`null`) pour ne pas afficher une timeline dégénérée à 1
 *    chapitre.
 *
 * Accessibilité :
 *  - `<button>` natifs avec aria-current sur l'actif.
 *  - Focus visible ring champagne (`#C8A876`).
 *  - Timestamps en tabular-nums pour ne pas faire « danser » la timeline.
 *
 * cf. docs/video-gestes-optim-2026-05/05-frontend-public-design.md §4
 */
'use client';

import { useCallback } from 'react';

import { resolveAccentHex } from '@/lib/composition/copy';
import { useTracking } from '@/lib/tracking/use-tracking';
import {
  findActiveChapterIndex,
  formatChapterIndex,
  formatChapterTimestamp,
} from '@/lib/video/chapters';
import type { RituelVideo, SubProductAccentColor, VideoChapter } from '@/lib/schemas';

export interface VideoChaptersProps {
  /**
   * Chapitres triés croissants (validé Zod en amont). Si `undefined` ou
   * `length < 2`, le composant retourne `null`.
   */
  chapters: ReadonlyArray<VideoChapter> | undefined;
  /** Couleur d'accent pour les underline + numéro. Fallback champagne. */
  accentColor?: SubProductAccentColor;
  /** Seconde courante de la vidéo (pour marquer l'actif). 0 par défaut. */
  currentSeconds?: number;
  /** ID stable pour le tracking (`video_id` dans `video_chapter_click`). */
  videoId: string;
  /**
   * Callback de seek. Reçoit `startSeconds` du chapitre cliqué. Si non
   * fourni, le click se contente d'émettre le tracking (utile en SSR ou
   * quand l'IFrame API n'est pas encore montée).
   */
  onSeek?: (startSeconds: number, chapter: VideoChapter) => void;
}

export function VideoChapters({
  chapters,
  accentColor,
  currentSeconds = 0,
  videoId,
  onSeek,
}: VideoChaptersProps): JSX.Element | null {
  const { emit } = useTracking();
  const accentHex = resolveAccentHex(accentColor);
  const activeIndex = chapters ? findActiveChapterIndex(chapters, currentSeconds) : -1;

  const handleClick = useCallback(
    (chapter: VideoChapter, index: number) => {
      emit('video_chapter_click', {
        video_id: videoId,
        chapter_key: chapter.key,
        chapter_label: chapter.label,
        chapter_index: index,
        chapter_start_seconds: chapter.startSeconds,
      });
      if (onSeek) onSeek(chapter.startSeconds, chapter);
    },
    [emit, onSeek, videoId],
  );

  if (!chapters || chapters.length < 2) return null;

  return (
    <nav
      aria-label="Chapitres de la vidéo"
      className="mx-auto mt-6 max-w-md"
      data-testid="video-chapters"
    >
      <ol className="grid grid-cols-4 gap-x-3 gap-y-1 text-start [font-variant-numeric:tabular-nums]">
        {chapters.map((chapter, index) => {
          const isActive = index === activeIndex;
          return (
            <li key={chapter.key} className="min-w-0">
              <button
                type="button"
                onClick={() => handleClick(chapter, index)}
                aria-current={isActive ? 'step' : undefined}
                data-testid={`video-chapter-${chapter.key}`}
                data-active={isActive ? 'true' : 'false'}
                className="group block w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A876] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E8EDE3] rounded-sm"
              >
                <span
                  aria-hidden="true"
                  className="block font-display text-[11px] uppercase tracking-[0.18em] text-encre/40"
                  style={{ color: isActive ? accentHex : undefined }}
                >
                  {formatChapterIndex(index)}
                </span>
                <span
                  className={[
                    'mt-1 block truncate font-body text-[13px] text-encre',
                    isActive
                      ? 'underline decoration-2 underline-offset-[6px]'
                      : 'opacity-80 group-hover:opacity-100',
                  ].join(' ')}
                  style={isActive ? { textDecorationColor: accentHex } : undefined}
                >
                  {chapter.label}
                </span>
                <span className="mt-0.5 block font-body text-[11px] text-encre/55">
                  {formatChapterTimestamp(chapter.startSeconds)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Adapter qui pioche les chapitres directement dans un `RituelVideo`. Sert
 * de point d'entrée idiomatique côté `VideoPlayer4Gestes`.
 */
export function VideoChaptersFromRituel({
  video,
  currentSeconds,
  videoId,
  onSeek,
}: {
  video: RituelVideo;
  currentSeconds?: number;
  videoId: string;
  onSeek?: (startSeconds: number, chapter: VideoChapter) => void;
}): JSX.Element | null {
  return (
    <VideoChapters
      chapters={video.chapters}
      accentColor={video.accentColor}
      currentSeconds={currentSeconds}
      videoId={videoId}
      onSeek={onSeek}
    />
  );
}
