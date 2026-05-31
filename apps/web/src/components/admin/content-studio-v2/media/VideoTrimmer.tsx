'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '../primitives';

const MAX_DURATION = 90;

export interface VideoTrimResult {
  startSec: number;
  endSec: number;
}

interface Props {
  src: string;
  onConfirm: (result: VideoTrimResult) => void;
  onCancel: () => void;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toFixed(1).padStart(4, '0')}`;
}

export function VideoTrimmer({ src, onConfirm, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    function onLoaded() {
      const dur = video!.duration;
      if (!Number.isFinite(dur)) return;
      setDuration(dur);
      setStart(0);
      setEnd(Math.min(dur, MAX_DURATION));
    }
    function onTimeUpdate() { setCurrentTime(video!.currentTime); }
    function onEnd() { setPlaying(false); }
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnd);
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnd);
    };
  }, [src]);

  // Clamp playback to the kept range while playing.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playing) return;
    if (video.currentTime < start) video.currentTime = start;
    if (video.currentTime >= end) {
      video.pause();
      setPlaying(false);
    }
  }, [currentTime, playing, start, end]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      if (video.currentTime < start || video.currentTime >= end) {
        video.currentTime = start;
      }
      void video.play();
      setPlaying(true);
    }
  }

  function jumpTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, seconds));
  }

  const selectedDuration = Math.max(0, end - start);
  const overLimit = selectedDuration > MAX_DURATION;

  return (
    <div className="cs-trimmer" style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 480 }}>
      <div style={{ position: 'relative', background: 'var(--cs-bg-sunken)', borderRadius: 'var(--cs-radius-md)', overflow: 'hidden' }}>
        <video
          ref={videoRef}
          src={src}
          style={{ width: '100%', maxHeight: 360, display: 'block', background: '#000' }}
          playsInline
          preload="metadata"
        />
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Lecture'}
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            width: 40,
            height: 40,
            borderRadius: 'var(--cs-radius-full)',
            background: 'rgba(0,0,0,0.65)',
            color: 'white',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
        </button>
      </div>

      <div
        style={{
          padding: '14px 16px',
          background: 'var(--cs-bg-elevated)',
          border: '1px solid var(--cs-border)',
          borderRadius: 'var(--cs-radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
          <span style={{ color: 'var(--cs-fg-secondary)' }}>
            Plage conservée : <strong className="cs-mono" style={{ color: 'var(--cs-fg-primary)' }}>{formatTime(start)}</strong> →{' '}
            <strong className="cs-mono" style={{ color: 'var(--cs-fg-primary)' }}>{formatTime(end)}</strong>
          </span>
          <span style={{ color: overLimit ? 'var(--cs-danger)' : 'var(--cs-fg-muted)' }} className="cs-mono">
            {selectedDuration.toFixed(1)}s / {MAX_DURATION}s
          </span>
        </div>
        <div style={{ position: 'relative', height: 28 }}>
          {/* Background bar */}
          <div style={{ position: 'absolute', inset: '12px 0', background: 'var(--cs-bg-sunken)', borderRadius: 3 }} />
          {/* Kept segment */}
          {duration > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 9,
                bottom: 9,
                left: `${(start / duration) * 100}%`,
                right: `${100 - (end / duration) * 100}%`,
                background: overLimit ? 'var(--cs-danger)' : 'var(--cs-accent)',
                borderRadius: 3,
              }}
            />
          )}
          {/* Current time marker */}
          {duration > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 4,
                bottom: 4,
                left: `${(currentTime / duration) * 100}%`,
                width: 2,
                background: 'var(--cs-fg-primary)',
                pointerEvents: 'none',
              }}
            />
          )}
          {/* Start handle */}
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.1"
            value={start}
            onChange={(e) => {
              const v = Math.min(Number(e.target.value), end - 0.5);
              setStart(v);
              jumpTo(v);
            }}
            aria-label="Début"
            style={rangeStyle}
          />
          {/* End handle (stacked on top, transparent track) */}
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.1"
            value={end}
            onChange={(e) => {
              const v = Math.max(Number(e.target.value), start + 0.5);
              setEnd(v);
              jumpTo(v);
            }}
            aria-label="Fin"
            style={{ ...rangeStyle, pointerEvents: 'all' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button onClick={() => onConfirm({ startSec: start, endSec: end })} disabled={overLimit || selectedDuration < 1}>
          Découper et importer
        </Button>
      </div>
    </div>
  );
}

const rangeStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  background: 'transparent',
  appearance: 'none',
  WebkitAppearance: 'none',
  pointerEvents: 'none',
};
