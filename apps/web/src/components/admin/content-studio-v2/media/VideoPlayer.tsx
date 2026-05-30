'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Film, Pause, Play, RotateCw, Volume2, VolumeX } from 'lucide-react';
import type { StudioV2MediaItem } from '@/lib/content-studio-v2/media/types';

export type VideoPlayerControls = 'auto' | 'always' | 'none';

interface VideoPlayerProps {
  media: StudioV2MediaItem;
  fit?: 'cover' | 'contain';
  /**
   * `auto` (default) — controls visible on hover/focus, hidden in idle play.
   * `always` — overlay constantly visible (useful in studio contexts).
   * `none`   — chrome-less, only the video. Used in confirm dialogs.
   */
  controls?: VideoPlayerControls;
  /** Compact variant (smaller icons, lighter padding) for dialogs. */
  compact?: boolean;
  /** Loop the playback. Defaults true. */
  loop?: boolean;
  /** Autoplay. Defaults true. */
  autoPlay?: boolean;
  /** Start muted. Defaults true (required for autoplay). */
  defaultMuted?: boolean;
  className?: string;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VideoPlayer({
  media,
  fit = 'cover',
  controls = 'auto',
  compact = false,
  loop = true,
  autoPlay = true,
  defaultMuted = true,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(defaultMuted);
  const [hovering, setHovering] = useState(false);
  const [durationSec, setDurationSec] = useState<number | null>(
    media.durationSec ?? null,
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoaded = () => {
      if (!media.durationSec && Number.isFinite(v.duration)) {
        setDurationSec(v.duration);
      }
    };
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('loadedmetadata', onLoaded);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [media.durationSec]);

  const showOverlay =
    controls === 'always' || (controls === 'auto' && (hovering || !isPlaying));
  const showChrome = controls !== 'none';

  const iconSize = compact ? 14 : 18;
  const overlayPad = compact ? 6 : 10;
  const badgeFontSize = compact ? 10 : 11;

  return (
    <div
      data-cs-video-player
      data-cs-video-playing={isPlaying ? 'true' : 'false'}
      data-cs-video-muted={isMuted ? 'true' : 'false'}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
        overflow: 'hidden',
      }}
    >
      <video
        ref={videoRef}
        src={media.previewUrl}
        poster={media.thumbnailUrl ?? undefined}
        muted={isMuted}
        loop={loop}
        playsInline
        autoPlay={autoPlay}
        aria-label={media.alt || 'Aperçu vidéo'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: fit,
          display: 'block',
        }}
      />

      {showChrome ? (
        <>
          {/* Badge VIDÉO + durée (bas-gauche, toujours visible) */}
          <div
            data-cs-video-badge
            style={{
              position: 'absolute',
              left: overlayPad,
              bottom: overlayPad,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: `${compact ? 2 : 4}px ${compact ? 6 : 8}px`,
              background: 'rgba(0, 0, 0, 0.65)',
              color: 'white',
              borderRadius: 'var(--cs-radius-full)',
              fontSize: badgeFontSize,
              fontWeight: 600,
              fontFamily: 'var(--cs-font-mono, ui-monospace)',
              letterSpacing: '0.04em',
              backdropFilter: 'blur(4px)',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <Film size={compact ? 10 : 12} aria-hidden />
            <span>VIDÉO</span>
            <span aria-hidden style={{ opacity: 0.6 }}>·</span>
            <span data-cs-video-duration>{formatDuration(durationSec)}</span>
          </div>

          {/* Indicateur loop (haut-droite, discret) */}
          {loop ? (
            <div
              data-cs-video-loop-indicator
              aria-label="Lecture en boucle"
              style={{
                position: 'absolute',
                right: overlayPad,
                top: overlayPad,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: `${compact ? 2 : 3}px ${compact ? 5 : 7}px`,
                background: 'rgba(0, 0, 0, 0.5)',
                color: 'rgba(255, 255, 255, 0.85)',
                borderRadius: 'var(--cs-radius-full)',
                fontSize: compact ? 9 : 10,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              <RotateCw size={compact ? 8 : 10} aria-hidden />
            </div>
          ) : null}

          {/* Overlay : play/pause central + mute en bas-droite */}
          {showOverlay ? (
            <>
              <button
                type="button"
                aria-label={isPlaying ? 'Mettre en pause' : 'Lire la vidéo'}
                data-cs-video-toggle-play
                onClick={togglePlay}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: compact ? 36 : 52,
                  height: compact ? 36 : 52,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.55)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(6px)',
                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.25)',
                  transition: 'opacity var(--cs-motion-fast, 150ms) ease',
                }}
              >
                {isPlaying ? (
                  <Pause size={iconSize + 6} aria-hidden />
                ) : (
                  <Play size={iconSize + 6} aria-hidden style={{ marginLeft: 2 }} />
                )}
              </button>

              <button
                type="button"
                aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
                data-cs-video-toggle-mute
                onClick={toggleMute}
                style={{
                  position: 'absolute',
                  right: overlayPad,
                  bottom: overlayPad,
                  width: compact ? 26 : 32,
                  height: compact ? 26 : 32,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {isMuted ? (
                  <VolumeX size={iconSize - 2} aria-hidden />
                ) : (
                  <Volume2 size={iconSize - 2} aria-hidden />
                )}
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
