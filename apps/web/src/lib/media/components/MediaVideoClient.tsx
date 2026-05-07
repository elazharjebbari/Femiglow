'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useMediaInView } from '@/lib/media/hooks/useMediaInView';
import { useReducedMotion } from '@/lib/media/hooks/useReducedMotion';
import type { MediaLoadingStrategy } from '@/lib/db/types';

interface VideoSource {
  url: string;
  mime: string;
}

export interface MediaVideoClientProps {
  sources: VideoSource[];
  poster?: string;
  width?: number;
  height?: number;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  controls: boolean;
  playsInline: boolean;
  ariaLabel?: string;
  caption?: string | null;
  className?: string;
  style?: CSSProperties;
  strategy: MediaLoadingStrategy;
}

export function MediaVideoClient({
  sources,
  poster,
  width,
  height,
  autoplay,
  muted,
  loop,
  controls,
  playsInline,
  ariaLabel,
  caption,
  className,
  style,
  strategy,
}: MediaVideoClientProps) {
  const reduced = useReducedMotion();
  const watchInView = strategy === 'viewport';
  const { ref: containerRef, inView } = useMediaInView<HTMLDivElement>({
    rootMargin: '200px',
    once: true,
  });
  const [activated, setActivated] = useState<boolean>(strategy === 'eager');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const aspectRatio = width && height ? `${width} / ${height}` : undefined;

  useEffect(() => {
    if (strategy === 'idle' && !activated) {
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void) => number;
      };
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(() => setActivated(true));
      } else {
        const t = setTimeout(() => setActivated(true), 800);
        return () => clearTimeout(t);
      }
    }
  }, [strategy, activated]);

  useEffect(() => {
    if (watchInView && inView) setActivated(true);
  }, [watchInView, inView]);

  const showVideo = strategy !== 'interaction' || activated;
  const effectiveAutoplay = autoplay && !reduced;
  const preload = strategy === 'eager' ? 'auto' : strategy === 'viewport' && !inView ? 'metadata' : 'auto';

  if (strategy === 'interaction' && !activated) {
    return (
      <button
        type="button"
        onClick={() => setActivated(true)}
        aria-label={ariaLabel ?? 'Lire la vidéo'}
        className={className}
        style={{
          position: 'relative',
          aspectRatio,
          width: '100%',
          padding: 0,
          border: 0,
          background: poster ? `center/cover no-repeat url("${poster}")` : '#1a1a1a',
          cursor: 'pointer',
          ...style,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '3rem',
          }}
        >
          ▶
        </span>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ aspectRatio, width: '100%', ...style }}
    >
      {showVideo && (
        <video
          ref={videoRef}
          poster={poster}
          preload={preload}
          autoPlay={effectiveAutoplay}
          muted={muted || effectiveAutoplay}
          loop={loop}
          controls={controls}
          playsInline={playsInline}
          width={width}
          height={height}
          aria-label={ariaLabel}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          {sources.map((s) => (
            <source key={s.url} src={s.url} type={s.mime} />
          ))}
          {caption ?? 'Ton navigateur ne supporte pas la lecture vidéo.'}
        </video>
      )}
    </div>
  );
}
