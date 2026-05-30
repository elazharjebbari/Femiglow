/**
 * `VideoPosterCover` — overlay click-to-play maison qui précède l'iframe
 * YouTube pour la section « Les gestes » de `/kit`.
 *
 * Kolenda §4.4 :
 *  - Poster = frame d'action maîtrisée (paste/powder/polissage),
 *    pas un visage tiers figé.
 *  - Bouton play 64×64 centré, couleur d'accent (pas le rouge YouTube).
 *  - Badge durée optionnel (« 90″ ») discret en bas-gauche.
 *  - Voile encre 15 % par-dessus le poster fallback pour neutraliser le
 *    branding tiers si on retombe sur la thumbnail YouTube.
 *
 * Comportement :
 *  - État initial `played=false` : rend un `<button>` avec poster + bouton
 *    play + badge durée. Aucune iframe — l'iframe ne se monte qu'après clic.
 *  - Au clic : appelle `onPlay()` (parent met `played=true`), puis le
 *    composant rend `<YouTubeEmbed>` avec `autoplay=1&mute=1&captions=fr`.
 *
 * Performance :
 *  - Poster en `priority` (LCP candidate).
 *  - Iframe différée jusqu'au clic → économie ~150 kB initial.
 *
 * Accessibilité :
 *  - `<button>` natif (clavier, role implicite, focus-visible).
 *  - `aria-label` reprend l'`alt` du poster.
 *  - Bouton play SVG `aria-hidden` (l'aria-label parent suffit).
 *  - Animation `motion-safe:` respecte prefers-reduced-motion.
 *
 * cf. docs/video-gestes-optim-2026-05/05-frontend-public-design.md §3
 */
'use client';

import Image from 'next/image';
import { useId, useMemo, type ForwardedRef, forwardRef } from 'react';

import { resolveAccentHex } from '@/lib/composition/copy';
import { YouTubeEmbed } from '@/components/sections/YouTubeEmbed';
import type { RituelVideo } from '@/lib/schemas';
import { sanitizeSvgClient } from '@/lib/kit/video/sanitize-svg-client';

/**
 * Phase 7E — libellés courts localisés de l'overlay éditorial du poster.
 * Tous optionnels via le défaut FR `DEFAULT_VIDEO_POSTER_STRINGS`. Ne couvre
 * QUE l'overlay UI (kicker, titre 2 lignes, sous-titre 2 lignes, aria play) —
 * aucun contenu long.
 */
export interface VideoPosterStrings {
  kicker: string;
  titleLine1: string;
  titleLine2: string;
  subtitleLine1: string;
  subtitleLine2: string;
  /** Préfixe de l'aria-label du bouton play (« Lancer la vidéo : <alt> »). */
  playAriaPrefix: string;
}

export const DEFAULT_VIDEO_POSTER_STRINGS: VideoPosterStrings = {
  kicker: 'La manucure japonaise',
  titleLine1: 'Brille 3 semaines.',
  titleLine2: 'Sans vernis.',
  subtitleLine1: "Cire d'abeille, silicates, poudre de perle.",
  subtitleLine2: "4 gestes en 90 secondes — c'est tout.",
  playAriaPrefix: 'Lancer la vidéo :',
};

export interface VideoPosterCoverProps {
  video: RituelVideo;
  /** ID stable pour le tracking analytics (`video_user_play`, etc.). */
  videoId: string;
  /** Titre accessible passé à l'iframe une fois montée. */
  iframeTitle: string;
  /** État piloté par le parent (single source of truth). */
  played: boolean;
  /** Callback déclenché par le clic utilisateur sur le poster. */
  onPlay: () => void;
  /** Phase 7E — libellés courts localisés de l'overlay. Défaut FR si absent. */
  strings?: VideoPosterStrings;
}

/**
 * Sous-composant qui choisit le rendu du média de fond du poster, selon la
 * cascade :
 *  1. `posterCoverSvg.source = 'inline'` → `<div dangerouslySetInnerHTML>`
 *     (re-sanitized côté client en défense en profondeur).
 *  2. `posterCoverSvg.source = 'file'`   → `<img src="/api/media/<id>">`.
 *  3. `posterCoverSvg.source = 'url'`    → `<img src={url}>`.
 *  4. Sinon (rétrocompat) → `<Image>` next/image sur posterCustom/poster.
 *
 * Le voile encre 15 % et le badge durée restent rendus par le parent.
 */
function PosterMedia({
  video,
  posterImage,
}: {
  video: RituelVideo;
  posterImage: { src: string; alt: string };
}): JSX.Element {
  const svg = video.posterCoverSvg;
  const sanitizedInline = useMemo(
    () => (svg?.source === 'inline' && svg.inline ? sanitizeSvgClient(svg.inline) : ''),
    [svg],
  );

  if (svg?.source === 'inline' && sanitizedInline) {
    return (
      <div
        className="absolute inset-0"
        role="img"
        aria-label={svg.meta?.ariaLabel ?? posterImage.alt}
        data-testid="video-poster-svg-inline"
        dangerouslySetInnerHTML={{ __html: sanitizedInline }}
      />
    );
  }
  if (svg?.source === 'file' && svg.fileMediaId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/kit-video-cover/${encodeURIComponent(svg.fileMediaId)}`}
        alt={svg.meta?.ariaLabel ?? posterImage.alt}
        className="absolute inset-0 h-full w-full object-cover"
        data-testid="video-poster-svg-file"
        loading="eager"
      />
    );
  }
  if (svg?.source === 'url' && svg.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={svg.url}
        alt={svg.meta?.ariaLabel ?? posterImage.alt}
        className="absolute inset-0 h-full w-full object-cover"
        data-testid="video-poster-svg-url"
        loading="eager"
        referrerPolicy="no-referrer"
      />
    );
  }

  // Fallback rétrocompat — next/image sur posterCustom/poster.
  return (
    <Image
      src={posterImage.src}
      alt={posterImage.alt}
      fill
      sizes="(min-width: 768px) 380px, 100vw"
      priority
      className="object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.02]"
    />
  );
}

function VideoPosterCoverImpl(
  {
    video,
    videoId,
    iframeTitle,
    played,
    onPlay,
    strings = DEFAULT_VIDEO_POSTER_STRINGS,
  }: VideoPosterCoverProps,
  iframeRef: ForwardedRef<HTMLIFrameElement>,
): JSX.Element {
  const buttonId = useId();
  const posterImage = video.posterCustom ?? video.poster;
  const playColor = resolveAccentHex(video.accentColor);

  if (played) {
    return (
      <div className="absolute inset-0">
        <YouTubeEmbed
          ref={iframeRef}
          url={video.youtubeUrl ?? ''}
          title={iframeTitle}
          videoId={videoId}
          aspectRatio="9-16"
          mute
          autoplay
          captions="fr"
          enableJsApi
        />
      </div>
    );
  }

  return (
    <button
      id={buttonId}
      type="button"
      onClick={onPlay}
      aria-label={`${strings.playAriaPrefix} ${posterImage.alt}`}
      className="group absolute inset-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A876] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E8EDE3]"
      data-testid="video-poster-cover"
    >
      {/* Voile encre ~45 % — voile renforcé pour garantir le contraste
          AAA du texte overlay (kicker + titre + sous-titre). Color literal
          car `bg-encre/X` rend transparent (la CSS var ne supporte pas le
          opacity-modifier Tailwind). */}
      <PosterMedia video={video} posterImage={posterImage} />
      <span aria-hidden="true" className="absolute inset-0 bg-[#2C2A28]/45" />

      {/*
        Kolenda §4.4 P3 — overlay éditorial sur poster vidéo.
        Structure :
          - Kicker uppercase tracking-wide sauge (clean girl tendance)
          - Titre 2 lignes en italique display (promesse outcome)
          - Sous-titre crème (curiosité + repère temps)
        Couleurs : kicker sauge-light pastel, titre+sub crème sur voile
        encre 45 % → ratio contraste ≥ 7:1 (AAA WCAG).
        Cadré bas pour ne pas masquer le centre où vit le bouton play.
        `aria-hidden` car l'aria-label du button parent porte déjà la
        sémantique d'action ; ce bloc est purement décoratif (sinon il
        ferait redondance avec le lecteur d'écran).
      */}
      <div
        aria-hidden="true"
        data-testid="video-poster-overlay-text"
        className="pointer-events-none absolute inset-x-4 top-6 flex flex-col gap-2 text-creme sm:inset-x-8 sm:top-10"
      >
        <span className="font-body text-[10px] font-medium uppercase tracking-[0.22em] text-[#C3D4B5] sm:text-[11px]">
          {strings.kicker}
        </span>
        <span
          className="font-display text-[26px] leading-[1.05] sm:text-[34px]"
          style={{ fontStyle: 'italic' }}
        >
          {strings.titleLine1}
          <br />
          {strings.titleLine2}
        </span>
        <span className="font-body text-[12px] leading-snug text-creme/85 sm:text-[13px]">
          {strings.subtitleLine1}
          <br />
          {strings.subtitleLine2}
        </span>
      </div>

      {/* Bouton play 64×64 centré, couleur d'accent maison.
          Élément décoratif — l'aria-label du <button> parent porte
          déjà la sémantique d'action. */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid h-16 w-16 place-items-center rounded-full shadow-lg motion-safe:transition-transform motion-safe:group-hover:scale-110"
        style={{ backgroundColor: playColor }}
        data-testid="video-poster-play-button"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" className="text-creme" aria-hidden="true">
          <path d="M5 3 L18 11 L5 19 Z" fill="currentColor" />
        </svg>
      </span>

      {video.durationDisplay ? (
        <span
          aria-hidden="true"
          className="absolute bottom-3 start-3 inline-flex items-center rounded-sm bg-[#2C2A28]/80 px-2 py-1 font-body text-[11px] uppercase tracking-[0.18em] text-creme [font-variant-numeric:tabular-nums]"
          data-testid="video-poster-duration-badge"
        >
          {video.durationDisplay}
        </span>
      ) : null}
    </button>
  );
}

export const VideoPosterCover = forwardRef<HTMLIFrameElement, VideoPosterCoverProps>(
  VideoPosterCoverImpl,
);
VideoPosterCover.displayName = 'VideoPosterCover';
