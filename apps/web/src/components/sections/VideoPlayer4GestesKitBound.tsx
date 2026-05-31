/**
 * RSC wrapper qui résout l'override singleton `kit:video` côté serveur,
 * puis délègue à `<VideoPlayer4Gestes>` côté client.
 *
 * Cascade serveur :
 *   override publié → merge sur le mock (cf. `resolveKitVideo`)
 *   sinon → mock pur
 *
 * Différent de `VideoPlayer4GestesBound` (utilisé sur `/rituel`) qui résout
 * uniquement le poster via le binding média.
 */
import 'server-only';

import { getTranslations } from 'next-intl/server';

import {
  VideoPlayer4Gestes,
  type VideoPlayer4GestesStrings,
} from './VideoPlayer4Gestes';
import { resolveKitVideo } from '@/lib/kit/video/resolver';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';
import type { RituelVideo } from '@/lib/schemas';

interface VideoPlayer4GestesKitBoundProps {
  /**
   * Phase 7E — locale active. `?? DEFAULT_LOCALE` pour rester back-compat
   * avec les callers legacy qui ne passent pas de locale.
   */
  locale?: Locale;
  /**
   * Phase 7E (7E-10) — vidéo localisée (transcript AR/EN) depuis le CMS
   * (`content.videoSrc`, qui spread `mockRituel{Ar,En}.videoGestes`). Fournie
   * en non-FR : `resolveKitVideo()` (mock FR + override admin) reste utilisé
   * en FR pour ne rien changer. Sans valeur → comportement legacy FR.
   */
  videoOverride?: RituelVideo;
}

/**
 * Phase 7E — résout aussi les libellés UI localisés (`marketing.kit.video`)
 * et les forwarde via `strings`. Les paragraphes de transcription restent
 * portés par `video.transcript` (contenu, hors scope i18n).
 */
export async function VideoPlayer4GestesKitBound({
  locale,
  videoOverride,
}: VideoPlayer4GestesKitBoundProps = {}): Promise<JSX.Element> {
  const { video: resolvedVideo } = resolveKitVideo();
  // FR (défaut) : mock FR + override admin. AR/EN : vidéo CMS localisée
  // (transcript traduit) — sinon le transcript fuitait le FR de kit.ts.
  const video = videoOverride ?? resolvedVideo;
  const t = await getTranslations({
    locale: locale ?? DEFAULT_LOCALE,
    namespace: 'marketing.kit.video',
  });
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
  return <VideoPlayer4Gestes video={video} strings={strings} />;
}
