# 05 — Frontend public

## 1. Hiérarchie cible

```
VideoPlayer4GestesBound (RSC wrapper)
  └─ VideoPlayer4Gestes (dispatcher YouTube / self-hosted)
       └─ VideoSection (Server, layout/h2/sous-titre/provenance)
            ├─ VideoPosterCover (Client, click-to-play overlay)
            │     └─ YouTubeEmbed (mounted lazily after click)
            ├─ VideoChapters (Client, timeline + click handlers)
            ├─ VideoIFrameTracker (Client, IFrame API events)
            ├─ VideoTranscript (Server, accordéon SSR-friendly)
            └─ VideoPostCta (Server, lien éditorial)
```

`YouTubeEmbed` reste exporté tel quel pour les usages indépendants (autres pages éventuelles).

## 2. `VideoSection v2`

```tsx
// apps/web/src/components/sections/VideoPlayer4Gestes.tsx (refonte phase 2-5)
'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { VideoPosterCover } from '@/components/kit/VideoPosterCover';
import { VideoChapters } from '@/components/kit/VideoChapters';
import { VideoIFrameTracker } from '@/components/kit/VideoIFrameTracker';
import { VideoTranscript } from '@/components/kit/VideoTranscript';
import { VideoPostCta } from '@/components/kit/VideoPostCta';
import { useTracking } from '@/lib/tracking/use-tracking';
import { parseYouTubeUrl } from '@/lib/video/youtube-url';
import type { RituelVideo } from '@/lib/schemas';

const VIDEO_ID = 'rituel-4-gestes';

export function VideoPlayer4Gestes({ video }: { video: RituelVideo }) {
  const youtubeParsed = video.youtubeUrl ? parseYouTubeUrl(video.youtubeUrl) : null;
  // Si pas d'URL YouTube valide → variante self-hosted (phase 7).
  if (!youtubeParsed) return <SelfHostedVariant video={video} />;
  return <YouTubeVariant video={video} />;
}

function YouTubeVariant({ video }: { video: RituelVideo }) {
  const titleId = useId();
  const [played, setPlayed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [duration, setDuration] = useState<number>(90);
  const { emit } = useTracking();

  const onPlayerReady = useCallback((p: { getDuration: () => number }) => {
    const d = p.getDuration();
    if (Number.isFinite(d) && d > 0) setDuration(d);
  }, []);

  const onSeekToChapter = useCallback((startSeconds: number, chapterKey: string) => {
    emit('video_chapter_click', {
      video_id: VIDEO_ID,
      chapter_key: chapterKey,
      target_seconds: startSeconds,
    });
    // Au premier clic chapitre, on monte aussi l'iframe et on saute.
    setPlayed(true);
    // Le tracker s'occupera de seekTo via player.seekTo() après ready.
  }, [emit]);

  return (
    <section
      id="video-gestes"
      aria-labelledby={titleId}
      className="bg-[#E8EDE3] py-20 lg:py-28"
      data-testid="video-section"
    >
      <Container width="page">
        <div className="mx-auto max-w-3xl text-center">
          <Kicker tone="champagne" withRule>Les gestes</Kicker>
          <Heading id={titleId} as="h2" size="display-md" italic="always" className="mt-5">
            Quatre gestes, en un seul plan.
          </Heading>
          <Text size="body" tone="secondary" className="mt-4">
            Quatre-vingt-dix secondes, un rythme lent, le geste avant les mots.
          </Text>
          {video.provenance ? (
            <Text size="caption" tone="tertiary" className="mt-2 font-display italic">
              {video.provenance}
            </Text>
          ) : null}
        </div>

        <div className="relative mx-auto mt-12 max-w-md aspect-[9/16]">
          <VideoPosterCover
            video={video}
            videoId={VIDEO_ID}
            played={played}
            onPlay={() => {
              setPlayed(true);
              emit('video_user_play', {
                video_id: VIDEO_ID,
                video_title: 'Rituel — 4 gestes',
                video_provider: 'youtube',
              });
            }}
            iframeRef={iframeRef}
          />
          {played ? (
            <VideoIFrameTracker
              iframeRef={iframeRef}
              videoId={VIDEO_ID}
              onReady={onPlayerReady}
              onCurrentTime={setCurrentSeconds}
            />
          ) : null}
        </div>

        {video.chapters && video.chapters.length > 0 ? (
          <VideoChapters
            chapters={video.chapters}
            currentSeconds={currentSeconds}
            durationSeconds={duration}
            accentColor={video.accentColor}
            onSeek={onSeekToChapter}
          />
        ) : null}

        <VideoTranscript transcript={video.transcript} videoId={VIDEO_ID} />

        <VideoPostCta href="#commander-femiglow" />
      </Container>
    </section>
  );
}

// `SelfHostedVariant` — conservée mais réécrite pour partager les sous-composants
// en phase 7 (cf. 08-plan-action-phases.md).
function SelfHostedVariant({ video }: { video: RituelVideo }) {
  /* … existant légèrement refactor pour exposer les mêmes sous-composants. */
  return null; // signature conservée, détail en phase 7
}
```

Changements vs actuel :

- Fond `bg-[#E8EDE3]` (sauge pâle Annexe A) au lieu de `bg-creme-warm`.
- H2 `Quatre gestes` (cohérence nom composant).
- Provenance italique sous le sous-titre, conditionnelle.
- `VideoPosterCover` remplace l'iframe direct.
- `VideoChapters` rendu conditionnel sous le player.
- `VideoIFrameTracker` instancié seulement quand `played === true`.
- `VideoPostCta` après la transcription.

## 3. `VideoPosterCover`

```tsx
// apps/web/src/components/kit/VideoPosterCover.tsx (nouveau)
'use client';

import Image from 'next/image';
import { useState, type MutableRefObject } from 'react';

import { resolveAccentHex } from '@/lib/composition/copy';
import { YouTubeEmbed } from '@/components/sections/YouTubeEmbed';
import type { RituelVideo } from '@/lib/schemas';

interface VideoPosterCoverProps {
  video: RituelVideo;
  videoId: string;
  played: boolean;
  onPlay: () => void;
  iframeRef: MutableRefObject<HTMLIFrameElement | null>;
}

export function VideoPosterCover({
  video,
  videoId,
  played,
  onPlay,
  iframeRef,
}: VideoPosterCoverProps): JSX.Element {
  const posterImage = video.posterCustom ?? video.poster;
  const playColor = resolveAccentHex(video.accentColor);

  if (played) {
    return (
      <div className="absolute inset-0">
        <YouTubeEmbed
          url={video.youtubeUrl!}
          title="Rituel — quatre gestes en vidéo"
          videoId={videoId}
          aspectRatio="9-16"
          mute
          captions="fr"
          enableJsApi
          iframeRef={iframeRef}
          autoplayOnMount
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Lancer la vidéo « ${posterImage.alt} »`}
      className="group absolute inset-0 overflow-hidden rounded-md"
      data-testid="video-poster-cover"
    >
      <Image
        src={posterImage.src}
        alt={posterImage.alt}
        fill
        sizes="(min-width: 768px) 380px, 100vw"
        priority
        className="object-cover motion-safe:transition-transform motion-safe:duration-700 group-hover:scale-[1.02]"
      />
      {/* Voile sauge atténué pour neutraliser le branding YouTube éventuel
          quand on retombe sur `poster` (sans `posterCustom`). */}
      <span aria-hidden="true" className="absolute inset-0 bg-encre/15" />

      {/* Bouton play 64×64 centré, couleur d'accent */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid h-16 w-16 place-items-center rounded-full shadow-lg motion-safe:transition-transform group-hover:scale-110"
        style={{ backgroundColor: playColor }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" className="text-creme">
          <path d="M5 3 L18 11 L5 19 Z" fill="currentColor" />
        </svg>
      </span>

      {video.durationDisplay ? (
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-3 inline-flex items-center rounded-sm bg-encre/70 px-2 py-1 font-body text-[11px] uppercase tracking-[0.18em] text-creme [font-variant-numeric:tabular-nums]"
        >
          {video.durationDisplay}
        </span>
      ) : null}
    </button>
  );
}
```

A11y :
- `<button>` natif (focus clavier, role implicite).
- `aria-label` reprend l'`alt` du poster.
- Voile décoratif `aria-hidden`.
- Le bouton play SVG est `aria-hidden` (l'aria-label parent suffit).

Performance :
- `priority` sur l'image poster (LCP candidate).
- `motion-safe:` pour respecter `prefers-reduced-motion`.
- `YouTubeEmbed` monté seulement quand `played === true` (sub-second pour first paint).

## 4. `VideoChapters`

```tsx
// apps/web/src/components/kit/VideoChapters.tsx (nouveau)
'use client';

import { activeChapterIndex, formatTimestamp } from '@/lib/video/chapters';
import { resolveAccentHex } from '@/lib/composition/copy';
import type { SubProductAccentColor, VideoChapter } from '@/lib/schemas';

interface VideoChaptersProps {
  chapters: VideoChapter[];
  currentSeconds: number;
  durationSeconds: number;
  accentColor?: SubProductAccentColor;
  onSeek: (startSeconds: number, chapterKey: string) => void;
}

export function VideoChapters({
  chapters,
  currentSeconds,
  durationSeconds,
  accentColor,
  onSeek,
}: VideoChaptersProps): JSX.Element {
  const activeIdx = activeChapterIndex(chapters, currentSeconds);
  const accentHex = resolveAccentHex(accentColor);

  return (
    <nav
      aria-label="Chapitres de la vidéo"
      data-testid="video-chapters"
      className="mx-auto mt-6 max-w-md"
    >
      <ol className="flex w-full overflow-hidden rounded-md border border-[#C7CCC2]">
        {chapters.map((chapter, idx) => {
          const isActive = idx === activeIdx;
          return (
            <li key={chapter.key} className="flex-1">
              <button
                type="button"
                onClick={() => onSeek(chapter.startSeconds, chapter.key)}
                aria-current={isActive ? 'true' : undefined}
                className={[
                  'group block w-full px-2 py-2.5 text-center transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#E8EDE3]',
                  isActive ? 'bg-[#FBFAF6]' : 'bg-transparent hover:bg-[#FBFAF6]/60',
                ].join(' ')}
                style={isActive ? { boxShadow: `inset 0 -2px 0 ${accentHex}` } : undefined}
                data-testid={`video-chapter-${chapter.key}`}
              >
                <span
                  className="block font-body text-[11px] uppercase tracking-[0.18em] text-encre/70"
                  style={isActive ? { color: accentHex } : undefined}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="block font-display text-base text-encre">{chapter.label}</span>
                <span className="block font-body text-[11px] text-encre/50 [font-variant-numeric:tabular-nums]">
                  {formatTimestamp(chapter.startSeconds)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

A11y :
- `<nav>` + `aria-label`.
- `<ol>` ordonnée (sémantiquement séquentielle).
- `aria-current="true"` sur le chapitre actif.
- Focus ring offset visible sur fond sauge.
- Navigation clavier native (`Tab` + `Enter`).

## 5. `VideoIFrameTracker`

```tsx
// apps/web/src/components/kit/VideoIFrameTracker.tsx (nouveau)
'use client';

import { useEffect, type MutableRefObject } from 'react';

import { useTracking } from '@/lib/tracking/use-tracking';
import { attachVideoTracker } from '@/lib/video/iframe-tracker';

interface Props {
  iframeRef: MutableRefObject<HTMLIFrameElement | null>;
  videoId: string;
  onReady?: (player: { getDuration: () => number }) => void;
  onCurrentTime?: (s: number) => void;
}

export function VideoIFrameTracker({ iframeRef, videoId, onReady, onCurrentTime }: Props) {
  const { emit } = useTracking();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let detach: (() => void) | undefined;

    (async () => {
      try {
        detach = await attachVideoTracker(iframe, {
          onProgress: (pct) =>
            emit(`video_progress_${pct}`, { video_id: videoId, video_provider: 'youtube' }),
          onComplete: () =>
            emit('video_complete', { video_id: videoId, video_provider: 'youtube' }),
        });
        // TODO phase 3.bis : exposer un setInterval léger qui pousse
        // `currentTime` via onCurrentTime pour piloter `VideoChapters`
        // — voir 03-data-model.md.
      } catch {
        // Graceful degradation : tracking enrichi désactivé.
      }
    })();

    return () => {
      detach?.();
    };
  }, [iframeRef, videoId, emit, onReady, onCurrentTime]);

  return null;
}
```

## 6. `VideoTranscript`

Server Component (pas d'état). Identique à l'accordion existant mais isolé :

```tsx
// apps/web/src/components/kit/VideoTranscript.tsx (nouveau)
'use client';

import { useId, useState } from 'react';

import { Text } from '@/components/ui/Text';
import { useTracking } from '@/lib/tracking/use-tracking';

export function VideoTranscript({ transcript, videoId }: { transcript: string; videoId: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { emit } = useTracking();

  return (
    <div className="mt-6 text-center">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) emit('video_transcript_open', { video_id: videoId });
            return next;
          });
        }}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-2 text-kicker uppercase font-medium text-encre/70 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre focus-visible:ring-offset-2 focus-visible:ring-offset-[#E8EDE3]"
      >
        {open ? 'Masquer la transcription' : 'Lire la transcription'}
      </button>
      <div id={id} hidden={!open} className="mx-auto mt-8 max-w-prose space-y-4 text-left">
        {transcript.split('\n\n').map((p, i) => (
          <Text key={i} size="body" tone="secondary">{p}</Text>
        ))}
      </div>
    </div>
  );
}
```

## 7. `VideoPostCta`

```tsx
// apps/web/src/components/kit/VideoPostCta.tsx (nouveau)
export function VideoPostCta({ href }: { href: string }) {
  return (
    <div className="mt-4 text-center">
      <a
        href={href}
        className="inline-flex items-center gap-1 pt-1 text-xs uppercase tracking-[0.18em] text-encre underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A876]/40"
        data-testid="video-post-cta"
      >
        Voir le pack ci-dessous <span aria-hidden="true">↓</span>
      </a>
    </div>
  );
}
```

## 8. Responsive

| Breakpoint | Comportement |
|---|---|
| `< 640 px` | Player 9:16 `max-w-md` centré, chapitres pleine largeur 4 colonnes |
| `640 px-1024 px` | Idem + padding section plus généreux |
| `≥ 1024 px` | Idem ; les chapitres restent sur 1 ligne (4-6 segments) |

Le scroll vertical naturel reste la norme — pas de carrousel mobile.

## 9. Accessibilité (WCAG AA)

- **`<section>` avec `aria-labelledby`** pointant le H2.
- **`<button>` natif** pour le poster cover et chaque chapitre (pas de div clickable).
- **`aria-current="true"`** sur le chapitre actif.
- **Focus ring champagne 40 %** + offset 2 px partout.
- **`aria-pressed`** sur le poster avant clic (state "play").
- **`prefers-reduced-motion`** : transitions désactivées via `motion-safe:` Tailwind.
- **Transcription** : `aria-expanded` + `aria-controls`, contenu en `hidden` propre.
- **Captions YouTube** activées par défaut (`cc_load_policy=1&cc_lang_pref=fr`).

## 10. Performance

- **Poster image `priority` + `next/image`** : LCP cible < 2 s mobile.
- **Iframe différée** : ne charge qu'après clic. Économise ~150 kB initial.
- **IFrame API chargée à la demande** : seulement après `played`, ~50 kB JS différé.
- **`VideoChapters`** : composant léger sans dépendance, ~3 kB.
- **`VideoIFrameTracker`** : monte uniquement quand `played === true`, donc côté serveur ne rend rien.

## 11. Cas d'erreur

| Cas | Fallback |
|---|---|
| `video.youtubeUrl` absent ou non parsable | Variante self-hosted (phase 7) |
| `video.posterCustom` absent | `video.poster` (rétrocompat) |
| `video.chapters` absent ou < 2 entrées | Pas de timeline rendue |
| `loadYouTubeIframeApi` échoue (ad-blocker) | Tracking enrichi off ; lecture vidéo reste OK |
| `video.provenance` absent | Pas de ligne italique |
| `video.durationDisplay` absent | Pas de badge sur le poster |
| `accentColor` absent | Fallback `champagne` (or poudré) |

## 12. Charte visuelle

| Élément | Token | Hex |
|---|---|---|
| Fond section | Sauge très pâle Annexe A | `#E8EDE3` |
| Poster overlay | Voile encre 15 % | `#2C2A28` à 15 % |
| Bouton play | `accentColor` (default `champagne`) | `#B8956B` |
| Badge durée | Encre 70 % | `#2C2A28` à 70 % |
| Chapitres border | Gris-sauge | `#C7CCC2` |
| Chapitre actif fond | Ivoire warm | `#FBFAF6` |
| Chapitre actif underline | `accentColor` | dynamique |
| Lien post-vidéo | Encre | `#2C2A28` |
| Focus ring | Champagne 40 % | `#C8A876` 40 % |
