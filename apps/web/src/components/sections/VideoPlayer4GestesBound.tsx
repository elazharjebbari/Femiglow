import 'server-only';
import type { RituelVideo } from '@/lib/schemas';
import { VideoPlayer4Gestes } from './VideoPlayer4Gestes';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface VideoPlayer4GestesBoundProps {
  video: RituelVideo;
  componentKey: string;
  /** Slot par défaut : 'poster'. */
  slot?: string;
}

/**
 * RSC wrapper qui résout `componentKey/poster` et override `video.poster.src`
 * avec l'URL de la variante JPEG la plus large du media actif. Le composant
 * client `VideoPlayer4Gestes` garde son API string-only pour `<video poster>`.
 */
export async function VideoPlayer4GestesBound({
  video,
  componentKey,
  slot = 'poster',
}: VideoPlayer4GestesBoundProps) {
  const resolved = await resolveComponentSlot(componentKey, slot);
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding || !resolved?.media) {
    return <VideoPlayer4Gestes video={video} />;
  }

  // Pick the largest JPEG (or PNG) variant for poster compatibility — many
  // browsers don't accept AVIF/WebP in the `poster` attribute reliably.
  const rasterVariants = resolved.media.variants
    .filter((v) => v.format === 'jpeg' || v.format === 'png')
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const posterUrl =
    rasterVariants[0]?.url ??
    resolved.media.originalUrl ??
    video.poster.src;

  const overriddenVideo: RituelVideo = {
    ...video,
    poster: {
      ...video.poster,
      src: posterUrl,
      alt: resolved.alt || video.poster.alt,
    },
  };

  return <VideoPlayer4Gestes video={overriddenVideo} />;
}
