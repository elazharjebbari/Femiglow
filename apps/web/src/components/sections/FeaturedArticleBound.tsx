import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { Article } from '@/lib/schemas';
import { FeaturedArticle, type FeaturedArticleStrings } from './FeaturedArticle';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';

interface FeaturedArticleBoundProps {
  article: Article;
  /**
   * Phase 7 wiring — locale active pour résoudre les libellés localisés
   * (`marketing.journal.article.*`). `?? DEFAULT_LOCALE` garde le FR legacy.
   */
  locale?: Locale;
}

/**
 * RSC wrapper qui résout le média à afficher pour l’article à la une.
 * Stratégie de résolution, dans l’ordre :
 *   1. Binding actif sur `journal-featured/primary` (override éditorial).
 *   2. Binding actif sur `journal-article-<slug>/cover` (cover de l’article).
 *   3. Fallback `article.featuredImage` du CMS (SVG).
 *
 * Le 2 permet de réutiliser la cover déjà seedée pour chaque article sans
 * exiger un binding dédié pour la mise en avant.
 */
export async function FeaturedArticleBound({
  article,
  locale,
}: FeaturedArticleBoundProps) {
  const featuredKey = 'journal-featured';
  const articleKey = `journal-article-${article.slug}`;
  const activeLocale = locale ?? DEFAULT_LOCALE;

  const [featured, articleCover, tArticle, tCategories] = await Promise.all([
    resolveComponentSlot(featuredKey, 'primary'),
    resolveComponentSlot(articleKey, 'cover'),
    getTranslations({ locale: activeLocale, namespace: 'marketing.journal.article' }),
    getTranslations({ locale: activeLocale, namespace: 'marketing.journal.categories' }),
  ]);

  const strings: FeaturedArticleStrings = {
    categoryLabel: tCategories(article.category),
    featuredBadge: tArticle('featured_badge'),
    readingTime: tArticle('reading_time', { min: article.readingTimeMinutes }),
    readArticle: tArticle('read_article'),
    readAriaLabel: tArticle('read_featured_aria', { title: article.title }),
  };

  const useFeatured = !!(featured?.binding?.isActive && featured?.media);
  const useArticleCover = !!(articleCover?.binding?.isActive && articleCover?.media);

  if (!useFeatured && !useArticleCover) {
    return <FeaturedArticle article={article} strings={strings} locale={activeLocale} />;
  }

  const resolvedKey = useFeatured ? featuredKey : articleKey;
  const resolvedSlot = useFeatured ? 'primary' : 'cover';

  return (
    <FeaturedArticle
      article={article}
      strings={strings}
      locale={activeLocale}
      mediaSlot={
        <ComponentMedia
          componentKey={resolvedKey}
          slot={resolvedSlot}
          context="hero"
          sizes="(min-width: 1024px) 60vw, 100vw"
          forcePriority
          altOverride={article.featuredImage.alt}
        />
      }
    />
  );
}
