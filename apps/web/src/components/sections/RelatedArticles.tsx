import type { ReactNode } from 'react';
import type { Article } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Fleuron } from '@/components/ui/Fleuron';
import { Heading } from '@/components/ui/Heading';
import { ArticleCard } from './ArticleCard';

interface RelatedArticlesProps {
  articles: Article[];
  /**
   * Cards déjà rendues côté serveur (typiquement `<ArticleCardBound>`),
   * indexées par `slug`. Si fourni pour un article, remplace `<ArticleCard>`.
   */
  cards?: Record<string, ReactNode>;
}

export function RelatedArticles({ articles, cards }: RelatedArticlesProps) {
  if (articles.length === 0) return null;
  return (
    <section
      aria-labelledby="article-related-title"
      className="border-t border-encre/10 bg-creme py-16 sm:py-20"
    >
      <Container width="page">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <Fleuron size="sm" />
          <Heading as="h2" size="md" italic="always" id="article-related-title">
            Lire ensuite
          </Heading>
        </div>
        <ul className="grid grid-cols-1 gap-12 sm:grid-cols-3 lg:gap-x-10 lg:gap-y-16">
          {articles.map((article) => (
            <li key={article.slug}>
              {cards?.[article.slug] ?? (
                <ArticleCard article={article} headingLevel="h3" />
              )}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
