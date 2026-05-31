'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { Article } from '@/lib/schemas';
import { ArticleCard, type ArticleCardStrings } from './ArticleCard';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Text } from '@/components/ui/Text';
import type { CategoryKey } from '@/lib/i18n/categories';

interface ArticleGridProps {
  initialArticles: Article[];
  /**
   * Nœuds React rendus côté serveur pour les cards initiales (typiquement
   * `<ArticleCardBound>`, qui résout le binding média de chaque article).
   * Si fourni, remplace le rendu client par défaut pour l’ensemble initial.
   * Doit être de même longueur que `initialArticles` et dans le même ordre.
   */
  initialCards?: ReactNode[];
  initialCursor: string | null;
  category: CategoryKey;
  cardHeadingLevel?: 'h2' | 'h3';
  /**
   * Phase 7 wiring — sur la route `/[locale]/journal`, localise via
   * `useTranslations` les cards ajoutées dynamiquement (« Voir d'autres
   * articles »). Défaut `false` → comportement legacy FR (route `/journal`).
   */
  localizeAppendedCards?: boolean;
}

interface ApiResponse {
  items: Article[];
  nextCursor: string | null;
}

export function ArticleGrid({
  initialArticles,
  initialCards,
  initialCursor,
  category,
  cardHeadingLevel = 'h3',
  localizeAppendedCards = false,
}: ArticleGridProps) {
  // Hooks toujours appelés (règles des hooks) ; n'ont d'effet que si
  // `localizeAppendedCards`. Sur la route legacy `/journal`, les valeurs FR
  // sont identiques aux défauts d'`ArticleCard`.
  const tArticle = useTranslations('marketing.journal.article');
  const tCategories = useTranslations('marketing.journal.categories');
  // Phase 9bis — libellés du bouton « Voir d'autres articles » + état final
  // localisés (fuitaient FR sur /ar/journal). Sous provider sur les deux routes.
  const tGrid = useTranslations('marketing.journal.grid');
  const buildCardStrings = (article: Article): ArticleCardStrings | undefined => {
    if (!localizeAppendedCards) return undefined;
    const categoryLabel = tCategories(article.category);
    return {
      categoryLabel,
      readingTime: tArticle('reading_time', { min: article.readingTimeMinutes }),
      readAriaLabel: tArticle('read_aria', {
        title: article.title,
        category: categoryLabel,
      }),
    };
  };
  // Articles ajoutés dynamiquement via « Voir d’autres articles ». Les cards
  // initiales restent rendues côté serveur (cf. `initialCards`) ; seules les
  // cards paginées sont rendues côté client avec `ArticleCard` (sans binding).
  const [appended, setAppended] = useState<Article[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loadMore = () => {
    if (!cursor) return;
    setError(null);
    const params = new URLSearchParams({ cursor });
    if (category !== 'all') params.set('category', category);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/articles?${params.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ApiResponse;
        const parsed: Article[] = data.items.map((item) => ({
          ...item,
          publishedAt: new Date(item.publishedAt),
          updatedAt: new Date(item.updatedAt),
        }));
        setAppended((prev) => [...prev, ...parsed]);
        setCursor(data.nextCursor);
      } catch (e) {
        setError('Le chargement n\u2019a pas abouti. Réessayer dans un instant.');
      }
    });
  };

  const hasInitial = initialArticles.length > 0;
  const total = initialArticles.length + appended.length;

  if (total === 0) {
    return (
      <Container width="page" className="py-12">
        <Text size="lead" tone="tertiary" className="text-center">
          Aucun article pour le moment dans cette catégorie.
        </Text>
      </Container>
    );
  }

  const useServerCards =
    initialCards && initialCards.length === initialArticles.length;

  return (
    <Container width="page" className="py-12 sm:py-16">
      <ul
        aria-live="polite"
        className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-16"
      >
        {hasInitial &&
          initialArticles.map((article, i) => {
            const cardStrings = buildCardStrings(article);
            return (
              <li key={article.slug}>
                {useServerCards ? (
                  initialCards![i]
                ) : (
                  <ArticleCard
                    article={article}
                    headingLevel={cardHeadingLevel}
                    {...(cardStrings ? { strings: cardStrings } : {})}
                  />
                )}
              </li>
            );
          })}
        {appended.map((article) => {
          const cardStrings = buildCardStrings(article);
          return (
            <li key={article.slug}>
              <ArticleCard
                article={article}
                headingLevel={cardHeadingLevel}
                {...(cardStrings ? { strings: cardStrings } : {})}
              />
            </li>
          );
        })}
      </ul>
      <div className="mt-16 flex flex-col items-center gap-3">
        {cursor ? (
          <Button variant="secondary" onClick={loadMore} loading={isPending}>
            {tGrid('load_more')}
          </Button>
        ) : (
          <Text size="caption" tone="tertiary">
            {tGrid('all_read')}
          </Text>
        )}
        {error && (
          <p role="alert" className="text-sm text-encre/70">
            {error}
          </p>
        )}
      </div>
    </Container>
  );
}
