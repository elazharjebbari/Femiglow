/**
 * `VideoIFrameTracker` — composant React-only (rend `null`) qui attache
 * un `attachVideoTracker` à l'iframe pointée par `iframeRef` dès qu'elle
 * existe.
 *
 *  - Émet `video_progress_25`, `_50`, `_75` au franchissement (une fois).
 *  - Émet `video_complete` à `PlayerState.ENDED` (une fois).
 *  - Pousse `currentSeconds` via `onCurrentTime` pour piloter
 *    `VideoChapters`.
 *  - Cleanup à l'unmount : arrête le polling + détruit le YT.Player.
 *  - Graceful degradation : si `loadYouTubeIframeApi` échoue (ad-blocker,
 *    réseau coupé, etc.), le composant ne fait rien — la lecture reste
 *    fonctionnelle, seul le tracking enrichi est désactivé.
 *
 * cf. docs/video-gestes-optim-2026-05/05-frontend-public-design.md §5
 */
'use client';

import { useEffect, type MutableRefObject, type RefObject } from 'react';

import { useTracking } from '@/lib/tracking/use-tracking';
import { attachVideoTracker } from '@/lib/video/iframe-tracker';

export interface VideoIFrameTrackerProps {
  /**
   * Ref vers l'iframe YouTube. Doit être montée AVANT que ce composant ne
   * soit rendu (`played === true`).
   */
  iframeRef: MutableRefObject<HTMLIFrameElement | null> | RefObject<HTMLIFrameElement | null>;
  /** ID stable de la vidéo (`video_id` dans les events). */
  videoId: string;
  /** Callback de mise à jour de currentTime (pour piloter VideoChapters). */
  onCurrentTime?: (seconds: number) => void;
  /** Callback de durée détectée à player.ready (utile pour les badges). */
  onDuration?: (seconds: number) => void;
}

export function VideoIFrameTracker({
  iframeRef,
  videoId,
  onCurrentTime,
  onDuration,
}: VideoIFrameTrackerProps): null {
  const { emit } = useTracking();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let detach: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const handle = await attachVideoTracker(iframe, {
          onReady: (player) => {
            const d = player.getDuration();
            if (Number.isFinite(d) && d > 0) onDuration?.(d);
          },
          onCurrentTime: (s) => onCurrentTime?.(s),
          onProgress: (pct) =>
            emit(`video_progress_${pct}`, {
              video_id: videoId,
              video_provider: 'youtube',
            }),
          onComplete: () =>
            emit('video_complete', {
              video_id: videoId,
              video_provider: 'youtube',
              video_title: 'Rituel — 4 gestes',
            }),
        });
        if (cancelled) {
          handle();
        } else {
          detach = handle;
        }
      } catch {
        // Graceful degradation : tracking enrichi désactivé. La lecture
        // reste OK (l'iframe fonctionne sans l'API).
      }
    })();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [iframeRef, videoId, emit, onCurrentTime, onDuration]);

  return null;
}
