import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { Article } from '@/lib/schemas';
import { ArticleCard, type ArticleCardStrings } from './ArticleCard';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';

interface ArticleCardBoundProps {
  article: Article;
  priority?: boolean;
  sizes?: string;
  headingLevel?: 'h2' | 'h3';
  /**
   * Phase 7 wiring — locale active pour résoudre les libellés localisés
   * (`marketing.journal.article.*`). `?? DEFAULT_LOCALE` garde le FR legacy.
   */
  locale?: Locale;
}

/**
 * RSC wrapper qui résout le slot 'cover' du composant
 * `journal-article-{slug}` et délègue à ArticleCard.
 *
 * Si pas de binding actif → ArticleCard utilise `article.featuredImage` du CMS.
 */
export async function ArticleCardBound({
  article,
  priority,
  sizes,
  headingLevel,
  locale,
}: ArticleCardBoundProps) {
  const componentKey = `journal-article-${article.slug}`;
  const activeLocale = locale ?? DEFAULT_LOCALE;
  const [resolved, tArticle, tCategories] = await Promise.all([
    resolveComponentSlot(componentKey, 'cover'),
    getTranslations({ locale: activeLocale, namespace: 'marketing.journal.article' }),
    getTranslations({ locale: activeLocale, namespace: 'marketing.journal.categories' }),
  ]);

  const categoryLabel = tCategories(article.category);
  const strings: ArticleCardStrings = {
    categoryLabel,
    readingTime: tArticle('reading_time', { min: article.readingTimeMinutes }),
    readAriaLabel: tArticle('read_aria', {
      title: article.title,
      category: categoryLabel,
    }),
  };

  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding) {
    return (
      <ArticleCard
        article={article}
        priority={priority}
        sizes={sizes}
        headingLevel={headingLevel}
        strings={strings}
        locale={activeLocale}
      />
    );
  }

  return (
    <ArticleCard
      article={article}
      priority={priority}
      sizes={sizes}
      headingLevel={headingLevel}
      strings={strings}
      locale={activeLocale}
      mediaSlot={
        <ComponentMedia
          componentKey={componentKey}
          slot="cover"
          context="inline"
          sizes={sizes}
          forcePriority={priority}
        />
      }
    />
  );
}
