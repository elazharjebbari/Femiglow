import 'server-only';
import type { CSSProperties } from 'react';
import { getMedia } from '@/lib/media/get-media';
import { resolveConfig, pickVariants, type MediaContextHint } from '@/lib/media/resolve/config';
import { blurhashToSvgDataUrl } from '@/lib/media/pipeline/blurhash-svg';
import { recordUsage } from '@/lib/media/usage';
import { MediaPlaceholder } from './MediaPlaceholder';
import { MediaImageClient } from './MediaImageClient';
import type {
  MediaLoadingStrategy,
  MediaObjectFit,
  MediaObjectPosition,
} from '@/lib/db/types';

interface BaseProps {
  context?: MediaContextHint;
  sizes?: string;
  priority?: boolean;
  loading?: MediaLoadingStrategy;
  fallback?: string;
  className?: string;
  style?: CSSProperties;
  alt?: string;
  route?: string;
  objectFit?: MediaObjectFit;
  objectPosition?: MediaObjectPosition;
  focalX?: number | null;
  focalY?: number | null;
  /**
   * Ratio imposé par le slot (`'4/5'`, `'16/9'`, `'1/1'`…). Si fourni,
   * le `<picture>` se verrouille à ce ratio plutôt qu'au ratio source.
   * Indispensable pour les grilles homogènes (cartes journal).
   */
  slotAspectRatio?: string;
  /**
   * Couleur de fond derrière l'image (utile en `contain`). Token CSS
   * (`creme`, `creme-warm`, `champagne-soft`…) ou hex/rgba.
   */
  backgroundFill?: string;
  /**
   * Affiche le blurhash en background pendant le chargement.
   * Défaut : `false` — le bg uni issu de la palette suffit, l'effet de flou
   * est jugé trop bruyant sur le rendu éditorial FemiGlow. Activer
   * ponctuellement pour une carte produit où le flou apporte du lyrisme.
   */
  blurPlaceholder?: boolean;
}

type MediaImageProps =
  | (BaseProps & { id: string; slug?: never })
  | (BaseProps & { slug: string; id?: never });

export async function MediaImage(props: MediaImageProps) {
  const {
    context = 'inline',
    sizes,
    priority,
    loading,
    fallback,
    className,
    style,
    alt,
    route,
    objectFit,
    objectPosition,
    focalX,
    focalY,
    slotAspectRatio,
    backgroundFill,
    blurPlaceholder = false,
  } = props;
  const idOrSlug = 'id' in props && props.id ? props.id : props.slug!;
  const media = await getMedia(idOrSlug);

  if (!media) {
    return (
      <MediaPlaceholder
        fallback={fallback}
        label={`média introuvable: ${idOrSlug}`}
        className={className}
        style={style}
      />
    );
  }

  if (media.kind !== 'image') {
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
        width={media.originalWidth ?? 1200}
        height={media.originalHeight ?? 800}
        fallback={fallback}
        label={alt ?? media.alt}
        ariaBusy
        className={className}
        style={style}
      />
    );
  }

  const config = resolveConfig({
    media,
    context,
    props: { priority, loading, sizes, alt },
  });
  const picked = pickVariants(media.variants, config);

  const byFormat = Array.from(picked.byFormat.entries()).map(([format, entries]) => ({
    format,
    entries,
  }));

  const fallbackList =
    picked.byFormat.get('jpeg') ?? picked.byFormat.get('png') ?? [];
  const fallbackVariant = fallbackList[fallbackList.length - 1] ??
    media.variants[media.variants.length - 1];
  const fallbackUrl = fallbackVariant?.url ?? media.originalUrl ?? '';

  // Le blurhash n'est calculé QUE si le caller demande explicitement le
  // flou de chargement (`blurPlaceholder=true`). Par défaut on s'en passe :
  // sur le rendu éditorial FemiGlow l'effet de flou est perçu comme bruyant
  // (cf. ticket UX 12/05). Le `bgColor` issu de la palette reste affiché
  // pendant le décode et suffit comme placeholder neutre.
  const blurDataUrl = blurPlaceholder && media.blurhash
    ? await blurhashToSvgDataUrl(media.blurhash).catch(() => undefined)
    : undefined;

  queueMicrotask(() => {
    void recordUsage({
      mediaId: media.id,
      route: route ?? '',
      component: 'MediaImage',
      context,
    });
  });

  return (
    <MediaImageClient
      byFormat={byFormat}
      fallbackUrl={fallbackUrl}
      fallbackWidth={media.originalWidth ?? 1200}
      fallbackHeight={media.originalHeight ?? 800}
      alt={config.alt}
      sizes={config.sizes}
      loading={config.loadingStrategy === 'eager' ? 'eager' : 'lazy'}
      fetchPriority={config.fetchPriority}
      decoding={config.decoding}
      blurDataUrl={blurDataUrl}
      palette={media.palette}
      className={className}
      style={style}
      strategy={config.loadingStrategy}
      objectFit={objectFit}
      objectPosition={objectPosition}
      focalX={focalX}
      focalY={focalY}
      slotAspectRatio={slotAspectRatio}
      backgroundFill={backgroundFill}
    />
  );
}
