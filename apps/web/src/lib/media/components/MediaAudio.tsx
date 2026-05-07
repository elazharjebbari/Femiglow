import 'server-only';
import type { CSSProperties } from 'react';
import { getMedia } from '@/lib/media/get-media';
import { resolveConfig, type MediaContextHint } from '@/lib/media/resolve/config';
import { recordUsage } from '@/lib/media/usage';
import { MediaPlaceholder } from './MediaPlaceholder';
import type { MediaLoadingStrategy } from '@/lib/db/types';

interface BaseProps {
  controls?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  loop?: boolean;
  context?: MediaContextHint;
  lazy?: MediaLoadingStrategy;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  fallback?: string;
  route?: string;
}

type MediaAudioProps =
  | (BaseProps & { id: string; slug?: never })
  | (BaseProps & { slug: string; id?: never });

export async function MediaAudio(props: MediaAudioProps) {
  const idOrSlug = 'id' in props && props.id ? props.id : props.slug!;
  const media = await getMedia(idOrSlug);
  const {
    controls = true,
    preload,
    loop = false,
    context = 'inline',
    lazy,
    className,
    style,
    ariaLabel,
    fallback,
    route,
  } = props;

  if (!controls) {
    throw new Error('MediaAudio requires controls=true (a11y)');
  }

  if (!media) {
    return (
      <MediaPlaceholder
        fallback={fallback}
        label={`audio introuvable: ${idOrSlug}`}
        className={className}
        style={style}
      />
    );
  }

  if (media.kind !== 'audio') {
    return (
      <MediaPlaceholder
        fallback={fallback}
        label={`type invalide: ${media.kind}`}
        className={className}
        style={style}
      />
    );
  }

  const isReady = media.status === 'ready' || media.status === 'passthrough';
  if (!isReady || media.variants.length === 0) {
    return (
      <MediaPlaceholder
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
  const effectivePreload =
    preload ?? (config.loadingStrategy === 'eager' ? 'auto' : 'metadata');

  const sources: Array<{ url: string; mime: string }> = [];
  for (const v of media.variants) {
    if (v.format === 'opus') sources.push({ url: v.url, mime: 'audio/ogg' });
    if (v.format === 'mp3') sources.push({ url: v.url, mime: 'audio/mpeg' });
  }

  queueMicrotask(() => {
    void recordUsage({
      mediaId: media.id,
      route: route ?? '',
      component: 'MediaAudio',
      context,
    });
  });

  return (
    <audio
      controls={controls}
      preload={effectivePreload}
      loop={loop}
      aria-label={ariaLabel ?? media.caption ?? media.alt}
      className={className}
      style={style}
    >
      {sources.map((s) => (
        <source key={s.url} src={s.url} type={s.mime} />
      ))}
    </audio>
  );
}
