import 'server-only';
import type { CSSProperties } from 'react';
import { getMedia } from '@/lib/media/get-media';
import { resolveConfig, type MediaContextHint } from '@/lib/media/resolve/config';
import { recordUsage } from '@/lib/media/usage';
import { MediaPlaceholder } from './MediaPlaceholder';
import { MediaVideoClient } from './MediaVideoClient';
import type { MediaLoadingStrategy } from '@/lib/db/types';

interface BaseProps {
  poster?: boolean | string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  lazy?: MediaLoadingStrategy;
  playsInline?: boolean;
  context?: MediaContextHint;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  fallback?: string;
  route?: string;
}

type MediaVideoProps =
  | (BaseProps & { id: string; slug?: never })
  | (BaseProps & { slug: string; id?: never });

export async function MediaVideo(props: MediaVideoProps) {
  const idOrSlug = 'id' in props && props.id ? props.id : props.slug!;
  const media = await getMedia(idOrSlug);
  const {
    poster = true,
    autoplay = false,
    muted,
    loop = false,
    controls = true,
    lazy,
    playsInline = true,
    context = 'inline',
    className,
    style,
    ariaLabel,
    fallback,
    route,
  } = props;

  if (!media) {
    return <MediaPlaceholder fallback={fallback} label={`vidéo introuvable: ${idOrSlug}`} className={className} style={style} />;
  }

  if (media.kind !== 'video') {
    return <MediaPlaceholder fallback={fallback} label={`type invalide: ${media.kind}`} className={className} style={style} />;
  }

  const isReady = media.status === 'ready' || media.status === 'passthrough';
  if (!isReady || media.variants.length === 0) {
    return (
      <MediaPlaceholder
        width={media.originalWidth ?? 1280}
        height={media.originalHeight ?? 720}
        fallback={fallback}
        label={ariaLabel ?? media.alt}
        ariaBusy
        className={className}
        style={style}
      />
    );
  }

  const config = resolveConfig({
    media,
    context,
    props: { loading: lazy },
  });

  const sources: Array<{ url: string; mime: string }> = [];
  for (const v of media.variants) {
    if (v.format === 'webm') sources.push({ url: v.url, mime: 'video/webm' });
    if (v.format === 'mp4') sources.push({ url: v.url, mime: 'video/mp4' });
  }

  const posterVariant = media.variants.find((v) => v.format === 'poster');
  const posterUrl =
    poster === false ? undefined : typeof poster === 'string' ? poster : posterVariant?.url;

  queueMicrotask(() => {
    void recordUsage({
      mediaId: media.id,
      route: route ?? '',
      component: 'MediaVideo',
      context,
    });
  });

  const effectiveAriaLabel =
    ariaLabel ?? (autoplay && !controls ? media.caption ?? media.alt : undefined);

  return (
    <MediaVideoClient
      sources={sources}
      poster={posterUrl}
      width={media.originalWidth ?? undefined}
      height={media.originalHeight ?? undefined}
      autoplay={autoplay}
      muted={muted ?? autoplay}
      loop={loop}
      controls={controls}
      playsInline={playsInline}
      ariaLabel={effectiveAriaLabel}
      caption={media.caption}
      className={className}
      style={style}
      strategy={config.loadingStrategy}
    />
  );
}
