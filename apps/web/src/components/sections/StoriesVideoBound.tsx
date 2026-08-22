/**
 * RSC wrapper des Stories vidéo `/kit`. Résout le feed (DB, déjà localisé) +
 * les libellés i18n, puis délègue à `<StoriesVideo>` (client). Rend `null`
 * si le flag est OFF ou si aucune story active → zéro régression.
 *
 * Voir docs/stories-video-2026-08-21/.
 */
import 'server-only';

import { getTranslations } from 'next-intl/server';

import { StoriesVideo } from './StoriesVideo';
import { getStoriesFeed } from '@/lib/stories/feed';
import { STORIES_ENABLED } from '@/lib/feature-flags/stories';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';
import type { StoriesStrings } from '@/lib/stories/types';

interface StoriesVideoBoundProps {
  locale?: Locale;
  /** `section` (défaut, après le hero desktop) ou `inline` (dans le hero mobile). */
  variant?: 'section' | 'inline';
}

export async function StoriesVideoBound({
  locale,
  variant = 'section',
}: StoriesVideoBoundProps = {}): Promise<JSX.Element | null> {
  if (!STORIES_ENABLED) return null;
  const activeLocale = locale ?? DEFAULT_LOCALE;

  const feed = await getStoriesFeed(activeLocale);
  if (feed.stories.length === 0) return null;

  const t = await getTranslations({
    locale: activeLocale,
    namespace: 'marketing.kit.stories',
  });
  const strings: StoriesStrings = {
    sectionLabel: t('sectionLabel'),
    heading: t('heading'),
    openAria: t('openAria'),
    // `{count}` est un argument ICU → il faut le fournir à next-intl (sinon la
    // clé brute est renvoyée). Résolu ici avec le nombre de stories.
    countLabel: t('countLabel', { count: feed.stories.length }),
    scrollHint: t('scrollHint'),
    scrollMore: t('scrollMore'),
    prevSegment: t('prevSegment'),
    nextSegment: t('nextSegment'),
    close: t('close'),
    mute: t('mute'),
    unmute: t('unmute'),
    pause: t('pause'),
    play: t('play'),
    segmentProgress: t('segmentProgress'),
    defaultCta: t('defaultCta'),
  };

  return <StoriesVideo feed={feed} strings={strings} variant={variant} />;
}
