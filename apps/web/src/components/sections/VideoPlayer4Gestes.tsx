'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { RituelVideo } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { useTracking } from '@/lib/tracking/use-tracking';
import { VideoPosterCover } from '@/components/kit/VideoPosterCover';
import { VideoChaptersFromRituel } from '@/components/kit/VideoChapters';
import { parseYouTubeUrl } from '@/lib/video/youtube-url';

interface VideoPlayer4GestesProps {
  video: RituelVideo;
}

const VIDEO_ID = 'rituel-4-gestes';

/**
 * @tracking-category section_video
 * @tracking-events video_user_play, video_autoplay_view, video_complete, video_transcript_open
 * @tracking-description Vidéo des 4 gestes — distingue user-initiated (clic sur controls) vs autoplay
 *   (IntersectionObserver). Émet video_user_play UNIQUEMENT pour les plays utilisateur, video_autoplay_view
 *   au franchissement des 25 % de durée, video_complete à la fin (une fois), video_transcript_open à
 *   l'ouverture de la transcription. cf. docs/analytics/03-events-funnel-audit.md §6.1.
 *
 * CHA-243 — Dispatcher backend :
 *   - Si `video.youtubeUrl` est défini ET parsable → délègue à `<YouTubeEmbed>`
 *     (iframe `youtube-nocookie.com`, sans cookies tant que pas de lecture).
 *   - Sinon → player HTML5 self-hosted historique avec autoplay au scroll.
 */
export function VideoPlayer4Gestes({ video }: VideoPlayer4GestesProps) {
  const youtubeParsed = video.youtubeUrl ? parseYouTubeUrl(video.youtubeUrl) : null;
  if (youtubeParsed) {
    return <YouTubeVariant video={video} />;
  }
  return <SelfHostedVariant video={video} />;
}

/**
 * Variante YouTube — iframe `youtube-nocookie.com`. Garde la transcription
 * dépliable (pas d'auto-captions YouTube pour les Shorts FR/AR garantis).
 */
function YouTubeVariant({ video }: VideoPlayer4GestesProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [played, setPlayed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const transcriptId = useId();
  const titleId = useId();
  const { emit } = useTracking();

  const toggleTranscript = useCallback((): void => {
    setShowTranscript((prev) => {
      const next = !prev;
      if (next) {
        emit('video_transcript_open', {
          video_id: VIDEO_ID,
          video_title: 'Rituel — 4 gestes',
        });
      }
      return next;
    });
  }, [emit]);

  const handlePlay = useCallback((): void => {
    setPlayed(true);
    emit('video_user_play', {
      video_id: VIDEO_ID,
      video_title: 'Rituel — 4 gestes',
      video_provider: 'youtube',
    });
  }, [emit]);

  return (
    <section
      aria-labelledby={titleId}
      className="bg-[#E8EDE3] py-20 lg:py-28"
      data-testid="video-section-youtube"
    >
      <Container width="page">
        <div className="mx-auto max-w-3xl text-center">
          <Kicker tone="champagne" withRule>
            Les gestes
          </Kicker>
          <Heading
            id={titleId}
            as="h2"
            size="display-md"
            italic="always"
            className="mt-5"
          >
            Quatre gestes, en un seul plan.
          </Heading>
          <Text size="body" tone="secondary" className="mt-4">
            Quatre-vingt-dix secondes, un rythme lent, le geste avant les mots.
          </Text>
        </div>

        <div className="relative mx-auto mt-12 aspect-[9/16] w-full max-w-md overflow-hidden rounded-md">
          <VideoPosterCover
            ref={iframeRef}
            video={video}
            videoId={VIDEO_ID}
            iframeTitle="Rituel — quatre gestes en vidéo"
            played={played}
            onPlay={handlePlay}
          />
        </div>

        <VideoChaptersFromRituel video={video} videoId={VIDEO_ID} />

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleTranscript}
            aria-expanded={showTranscript}
            aria-controls={transcriptId}
            className="inline-flex items-center gap-2 text-kicker uppercase font-medium text-encre/70 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre focus-visible:ring-offset-2 focus-visible:ring-offset-creme-warm"
          >
            {showTranscript ? 'Masquer la transcription' : 'Lire la transcription'}
          </button>
        </div>

        <div
          id={transcriptId}
          hidden={!showTranscript}
          className="mx-auto mt-8 max-w-prose space-y-4"
        >
          {video.transcript.split('\n\n').map((paragraphe, i) => (
            <Text key={i} size="body" tone="secondary">
              {paragraphe}
            </Text>
          ))}
        </div>
      </Container>
    </section>
  );
}

/**
 * Variante self-hosted — player HTML5 avec autoplay au scroll. Code historique.
 */
function SelfHostedVariant({ video }: VideoPlayer4GestesProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptId = useId();
  const titleId = useId();
  const { emit } = useTracking();
  const userInitiatedRef = useRef(false);
  const userPlayFired = useRef(false);
  const autoplayViewFired = useRef(false);
  const completeFired = useRef(false);

  const baseParams = {
    video_id: VIDEO_ID,
    video_title: 'Rituel — 4 gestes',
    video_provider: 'self_hosted',
  };

  const markUserInitiated = useCallback((): void => {
    userInitiatedRef.current = true;
  }, []);

  const onPlay = useCallback((): void => {
    if (userInitiatedRef.current && !userPlayFired.current) {
      userPlayFired.current = true;
      emit('video_user_play', baseParams);
    }
    // Autoplay → on ne tire RIEN au play. video_autoplay_view est tiré
    // au franchissement de 25 % via onTimeUpdate.
  }, [emit]);

  const onTimeUpdate = useCallback((): void => {
    if (autoplayViewFired.current || userInitiatedRef.current) return;
    const el = ref.current;
    if (!el || !Number.isFinite(el.duration) || el.duration === 0) return;
    if (el.currentTime / el.duration >= 0.25) {
      autoplayViewFired.current = true;
      emit('video_autoplay_view', { ...baseParams, video_duration: el.duration });
    }
  }, [emit]);

  const onEnded = useCallback((): void => {
    if (completeFired.current) return;
    completeFired.current = true;
    emit('video_complete', baseParams);
  }, [emit]);

  const toggleTranscript = useCallback((): void => {
    setShowTranscript((prev) => {
      const next = !prev;
      if (next) {
        emit('video_transcript_open', {
          video_id: VIDEO_ID,
          video_title: 'Rituel — 4 gestes',
        });
      }
      return next;
    });
  }, [emit]);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced]);

  return (
    <section
      aria-labelledby={titleId}
      className="bg-[#E8EDE3] py-20 lg:py-28"
    >
      <Container width="page">
        <div className="mx-auto max-w-3xl text-center">
          <Kicker tone="champagne" withRule>
            Les gestes
          </Kicker>
          <Heading
            id={titleId}
            as="h2"
            size="display-md"
            italic="always"
            className="mt-5"
          >
            Quatre gestes, en un seul plan.
          </Heading>
          <Text size="body" tone="secondary" className="mt-4">
            Quatre-vingt-dix secondes, un rythme lent, le geste avant les mots.
          </Text>
        </div>

        <div className="mt-12 overflow-hidden rounded-md bg-encre/5">
          <video
            ref={ref}
            poster={video.poster.src}
            preload="metadata"
            muted
            playsInline
            loop
            controls={Boolean(reduced)}
            aria-describedby={transcriptId}
            className="h-auto w-full"
            onPlay={onPlay}
            onEnded={onEnded}
            onTimeUpdate={onTimeUpdate}
            onPointerDown={markUserInitiated}
            onKeyDown={(e) => {
              // Touches "natives" qui déclenchent le play du <video> en mode controls.
              if (e.key === ' ' || e.key === 'Enter' || e.key === 'k') {
                markUserInitiated();
              }
            }}
          >
            <source src={video.sources.webm} type="video/webm" />
            <source src={video.sources.mp4} type="video/mp4" />
            <track kind="captions" srcLang="fr" src={video.captions.fr} label="Français" default />
            <track kind="captions" srcLang="ar" src={video.captions.ar} label="العربية" />
          </video>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleTranscript}
            aria-expanded={showTranscript}
            aria-controls={transcriptId}
            className="inline-flex items-center gap-2 text-kicker uppercase font-medium text-encre/70 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre focus-visible:ring-offset-2 focus-visible:ring-offset-creme-warm"
          >
            {showTranscript ? 'Masquer la transcription' : 'Lire la transcription'}
          </button>
        </div>

        <div
          id={transcriptId}
          hidden={!showTranscript}
          className="mx-auto mt-8 max-w-prose space-y-4"
        >
          {video.transcript.split('\n\n').map((paragraphe, i) => (
            <Text key={i} size="body" tone="secondary">
              {paragraphe}
            </Text>
          ))}
        </div>
      </Container>
    </section>
  );
}
