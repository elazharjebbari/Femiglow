import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { Article } from '@/lib/schemas';
import { ArticleHero } from './ArticleHero';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';

interface ArticleHeroBoundProps {
  article: Article;
  /**
   * Phase 7 wiring — locale active pour résoudre catégorie + durée de lecture
   * (`marketing.journal.*`). `?? DEFAULT_LOCALE` garde le FR legacy.
   */
  locale?: Locale;
}

/**
 * RSC wrapper qui résout le slot `journal-article-{slug}/cover` et délègue
 * à `ArticleHero`. Si aucun binding actif → fallback CMS featuredImage.
 */
export async function ArticleHeroBound({ article, locale }: ArticleHeroBoundProps) {
  const componentKey = `journal-article-${article.slug}`;
  const activeLocale = locale ?? DEFAULT_LOCALE;
  const [resolved, tArticle, tCategories] = await Promise.all([
    resolveComponentSlot(componentKey, 'cover'),
    getTranslations({ locale: activeLocale, namespace: 'marketing.journal.article' }),
    getTranslations({ locale: activeLocale, namespace: 'marketing.journal.categories' }),
  ]);

  const strings = {
    categoryLabel: tCategories(article.category),
    readingTimeLabel: tArticle('reading_time', { min: article.readingTimeMinutes }),
  };

  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding) {
    return <ArticleHero article={article} strings={strings} locale={activeLocale} />;
  }

  return (
    <ArticleHero
      article={article}
      strings={strings}
      locale={activeLocale}
      mediaSlot={
        <ComponentMedia
          componentKey={componentKey}
          slot="cover"
          context="hero"
          sizes="100vw"
          forcePriority
          altOverride={article.featuredImage.alt}
          className="w-full"
        />
      }
    />
  );
}
