import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { RituelVideo } from '@/lib/schemas';
import {
  VideoPlayer4Gestes,
  type VideoPlayer4GestesStrings,
} from './VideoPlayer4Gestes';
import { resolveComponentSlot } from '@/lib/components/resolver';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';

interface VideoPlayer4GestesBoundProps {
  video: RituelVideo;
  componentKey: string;
  /** Slot par défaut : 'poster'. */
  slot?: string;
  /**
   * Phase 7 wiring — locale active pour résoudre les libellés UI localisés
   * (`marketing.rituel.video`). `?? DEFAULT_LOCALE` garde le comportement FR
   * pour les callers legacy. Mirror du pattern `VideoPlayer4GestesKitBound`.
   */
  locale?: Locale;
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
  locale,
}: VideoPlayer4GestesBoundProps) {
  const [resolved, t] = await Promise.all([
    resolveComponentSlot(componentKey, slot),
    getTranslations({
      locale: locale ?? DEFAULT_LOCALE,
      namespace: 'marketing.rituel.video',
    }),
  ]);
  const strings: VideoPlayer4GestesStrings = {
    kicker: t('kicker'),
    title: t('title'),
    subtitle: t('subtitle'),
    transcriptShow: t('transcript_show'),
    transcriptHide: t('transcript_hide'),
    postCta: t('post_cta'),
    poster: {
      kicker: t('poster.kicker'),
      titleLine1: t('poster.title_line1'),
      titleLine2: t('poster.title_line2'),
      subtitleLine1: t('poster.subtitle_line1'),
      subtitleLine2: t('poster.subtitle_line2'),
      playAriaPrefix: t('poster.play_aria_prefix'),
    },
  };
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding || !resolved?.media) {
    return <VideoPlayer4Gestes video={video} strings={strings} />;
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

  return <VideoPlayer4Gestes video={overriddenVideo} strings={strings} />;
}
