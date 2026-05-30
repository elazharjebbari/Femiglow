'use client';

import { useState } from 'react';
import { Mic, Captions, Clapperboard, Loader2 } from 'lucide-react';

/**
 * MP-VO/SU/CO UI (BUG-004) — the "Studio média" tracks panel. Shown in the
 * Visuel step when the primary media is a video (reel/story) and the media-studio
 * flag is on. Each track calls its per-draft route (voice-over / subtitles /
 * compose). Self-contained: own state + fetches, no change to MediaStudio's
 * existing logic.
 */

interface VoiceoverResult {
  id: string;
  previewUrl: string;
  provider: string;
  voice: string;
  durationSec: number | null;
}
interface SubtitlesResult {
  id: string;
  srt: string;
  cueCount: number;
  provider: string;
}
interface ComposeResult {
  id: string;
  previewUrl: string;
  hasVoiceover: boolean;
  hasMusic: boolean;
  hasSubtitles: boolean;
  durationSec: number | null;
}

interface Props {
  draftId: string;
}

async function postJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const json = (await res.json().catch(() => null)) as { media?: T; error?: { message?: string } } | null;
  if (!res.ok || !json?.media) {
    throw new Error(json?.error?.message ?? `Échec (${res.status}).`);
  }
  return json.media;
}

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--cs-border, #e6e1da)',
  borderRadius: 12,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  background: 'var(--cs-surface, #fff)',
};

const trackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingTop: 10,
  borderTop: '1px solid var(--cs-border-subtle, #f0ece6)',
};

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 8,
  border: '1px solid var(--cs-border, #d9d3ca)',
  background: 'var(--cs-surface, #fff)',
  cursor: 'pointer',
  fontSize: 13,
  alignSelf: 'flex-start',
};

const errStyle: React.CSSProperties = { color: '#b3261e', fontSize: 12 };

export function MediaStudioTracks({ draftId }: Props) {
  const [voiceover, setVoiceover] = useState<VoiceoverResult | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitlesResult | null>(null);
  const [composed, setComposed] = useState<ComposeResult | null>(null);
  const [busy, setBusy] = useState<'vo' | 'su' | 'co' | null>(null);
  const [error, setError] = useState<{ track: 'vo' | 'su' | 'co'; message: string } | null>(null);

  const run = async <T,>(
    track: 'vo' | 'su' | 'co',
    url: string,
    set: (v: T) => void,
  ) => {
    setBusy(track);
    setError(null);
    try {
      set(await postJson<T>(url));
    } catch (e) {
      setError({ track, message: e instanceof Error ? e.message : 'Erreur inconnue.' });
    } finally {
      setBusy(null);
    }
  };

  const base = `/api/admin/content-studio/drafts/${draftId}`;

  return (
    <section style={panelStyle} aria-label="Studio média" data-cs-media-tracks>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
        <Clapperboard size={16} aria-hidden /> Studio média
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--cs-text-muted, #6b6258)' }}>
        Ajoute une voix-off, des sous-titres, puis assemble le montage final.
      </p>

      {/* Voice-over */}
      <div style={trackStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, fontSize: 13 }}>
          <Mic size={14} aria-hidden /> Voix-off
        </div>
        <button
          type="button"
          style={btnStyle}
          onClick={() => run<VoiceoverResult>('vo', `${base}/generate-voiceover`, setVoiceover)}
          disabled={busy !== null}
          data-cs-generate-voiceover
        >
          {busy === 'vo' ? <Loader2 size={14} className="cs-spin" aria-hidden /> : <Mic size={14} aria-hidden />}
          {voiceover ? 'Regénérer la voix-off' : 'Générer la voix-off'}
        </button>
        {voiceover ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={voiceover.previewUrl} style={{ width: '100%' }} data-cs-voiceover-player />
            <span style={{ fontSize: 11, color: 'var(--cs-text-muted, #6b6258)' }}>
              {voiceover.provider} · {voiceover.durationSec ?? '?'}s
            </span>
          </div>
        ) : null}
        {error?.track === 'vo' ? <span style={errStyle}>{error.message}</span> : null}
      </div>

      {/* Subtitles */}
      <div style={trackStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, fontSize: 13 }}>
          <Captions size={14} aria-hidden /> Sous-titres
        </div>
        <button
          type="button"
          style={btnStyle}
          onClick={() => run<SubtitlesResult>('su', `${base}/generate-subtitles`, setSubtitles)}
          disabled={busy !== null}
          data-cs-generate-subtitles
        >
          {busy === 'su' ? <Loader2 size={14} className="cs-spin" aria-hidden /> : <Captions size={14} aria-hidden />}
          {subtitles ? 'Regénérer les sous-titres' : 'Générer les sous-titres'}
        </button>
        {subtitles ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--cs-text-muted, #6b6258)' }} data-cs-subtitles-count>
              {subtitles.cueCount} sous-titre(s) · {subtitles.provider}
            </span>
            <textarea
              readOnly
              value={subtitles.srt}
              rows={5}
              aria-label="Aperçu SRT"
              style={{ fontFamily: 'monospace', fontSize: 11, padding: 8, borderRadius: 8, border: '1px solid var(--cs-border, #e6e1da)' }}
            />
          </div>
        ) : null}
        {error?.track === 'su' ? <span style={errStyle}>{error.message}</span> : null}
      </div>

      {/* Compose */}
      <div style={trackStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, fontSize: 13 }}>
          <Clapperboard size={14} aria-hidden /> Montage
        </div>
        <button
          type="button"
          style={{ ...btnStyle, background: 'var(--cs-accent, #2f2a26)', color: '#fff', borderColor: 'transparent' }}
          onClick={() => run<ComposeResult>('co', `${base}/compose`, setComposed)}
          disabled={busy !== null}
          data-cs-compose
        >
          {busy === 'co' ? <Loader2 size={14} className="cs-spin" aria-hidden /> : <Clapperboard size={14} aria-hidden />}
          {composed ? 'Recomposer le montage' : 'Composer le montage'}
        </button>
        {composed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <video controls src={composed.previewUrl} style={{ width: '100%', borderRadius: 8 }} data-cs-composed-player />
            <span style={{ fontSize: 11, color: 'var(--cs-text-muted, #6b6258)' }} data-cs-compose-manifest>
              {[
                composed.hasVoiceover ? '🎙️ voix-off' : null,
                composed.hasMusic ? '🎵 musique' : null,
                composed.hasSubtitles ? '💬 sous-titres' : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'vidéo seule'}
            </span>
          </div>
        ) : null}
        {error?.track === 'co' ? <span style={errStyle}>{error.message}</span> : null}
      </div>
    </section>
  );
}
