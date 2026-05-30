import 'server-only';
import type { ReactNode } from 'react';
import type { Article } from '@/lib/schemas';
import { RelatedArticles } from './RelatedArticles';
import { ArticleCardBound } from './ArticleCardBound';
import type { Locale } from '@/i18n.config';

interface RelatedArticlesBoundProps {
  articles: Article[];
  /** Phase 7 wiring — locale active forwardée à chaque `ArticleCardBound`. */
  locale?: Locale;
}

/**
 * RSC wrapper qui pré-rend chaque card via `<ArticleCardBound>` côté serveur,
 * permettant la résolution du binding `journal-article-<slug>/cover` pour les
 * articles connexes (3 cards). Sans ce wrapper, `RelatedArticles` (qui peut être
 * rendu dans une page client-rendered) ne peut pas résoudre les bindings.
 *
 * La résolution étant faite par chaque `ArticleCardBound`, le `cards` map est
 * indexé par slug et passé au composant `RelatedArticles` qui s'en sert s'il
 * est fourni, sinon fallback sur `<ArticleCard>` standard.
 */
export async function RelatedArticlesBound({
  articles,
  locale,
}: RelatedArticlesBoundProps) {
  const cards: Record<string, ReactNode> = {};
  await Promise.all(
    articles.map(async (article) => {
      cards[article.slug] = (
        <ArticleCardBound
          article={article}
          headingLevel="h3"
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 33vw, 100vw"
          {...(locale ? { locale } : {})}
        />
      );
    }),
  );

  return <RelatedArticles articles={articles} cards={cards} />;
}
