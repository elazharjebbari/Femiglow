import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Article } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Image } from '@/components/ui/Image';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { categoryLabels } from '@/lib/i18n/categories';
import { routes } from '@/lib/routes';
import { formatArticleDate } from '@/lib/utils/format-date';

/**
 * Phase 7 wiring — libellés localisés de l'article à la une. Tous résolus en
 * amont (`marketing.journal.article.*`) par `FeaturedArticleBound`. Défaut FR
 * si absent, pour préserver les usages legacy + les tests.
 */
export interface FeaturedArticleStrings {
  /** Catégorie localisée (override de `categoryLabels[category]`). */
  categoryLabel?: string;
  /** Badge « à la une » localisé. */
  featuredBadge: string;
  /** Durée de lecture déjà interpolée (`{min} min de lecture`). */
  readingTime: string;
  /** Libellé du CTA « Lire l'article ». */
  readArticle: string;
  /** aria-label du lien média (`Lire l'article à la une : {title}`). */
  readAriaLabel: string;
}

interface FeaturedArticleProps {
  article: Article;
  /** Slot media déjà résolu (Component-Media). Remplace `featuredImage`. */
  mediaSlot?: ReactNode;
  /** Phase 7 wiring — libellés localisés. Défaut FR si absent. */
  strings?: FeaturedArticleStrings;
  /** Phase 9 i18n — locale active pour le format de date. Défaut FR. */
  locale?: string;
}

export function FeaturedArticle({
  article,
  mediaSlot,
  strings,
  locale,
}: FeaturedArticleProps) {
  const categoryLabel = strings?.categoryLabel ?? categoryLabels[article.category];
  const featuredBadge = strings?.featuredBadge ?? 'à la une';
  const readingTime =
    strings?.readingTime ?? `${article.readingTimeMinutes} min de lecture`;
  const readArticle = strings?.readArticle ?? 'Lire l’article';
  const readAriaLabel =
    strings?.readAriaLabel ??
    `Lire l’article à la une : ${article.title}`;
  return (
    <section
      aria-labelledby="journal-featured-title"
      className="border-y border-encre/10 bg-creme py-16 sm:py-20"
    >
      <Container width="page">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-16">
          <div className="lg:col-span-7">
            <Link
              href={routes.article(article.slug)}
              aria-label={readAriaLabel}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre/40 focus-visible:ring-offset-4 focus-visible:ring-offset-creme"
            >
              {mediaSlot ?? (
                <Image
                  src={article.featuredImage.src}
                  alt={article.featuredImage.alt}
                  width={article.featuredImage.width}
                  height={article.featuredImage.height}
                  ratio="4:3"
                  priority
                  sizes="(min-width: 1024px) 60vw, 100vw"
                />
              )}
            </Link>
          </div>
          <div className="space-y-5 lg:col-span-5">
            <div className="flex flex-col gap-2">
              <Kicker tone="champagne" withRule>
                {featuredBadge}
              </Kicker>
              <Kicker>{categoryLabel}</Kicker>
            </div>
            <Heading
              as="h2"
              size="lg"
              italic="always"
              id="journal-featured-title"
            >
              <Link href={routes.article(article.slug)} className="hover:text-encre/80">
                {article.title}
              </Link>
            </Heading>
            <Text size="lead" tone="secondary">
              {article.excerpt}
            </Text>
            <Text size="caption" tone="tertiary">
              <time dateTime={article.publishedAt.toISOString()}>
                {formatArticleDate(article.publishedAt, locale)}
              </time>
              <span aria-hidden="true"> · </span>
              {readingTime}
            </Text>
            <p className="pt-2">
              <Link
                href={routes.article(article.slug)}
                className="inline-flex items-center gap-2 border-b border-encre/40 pb-1 font-body text-sm uppercase tracking-[0.2em] text-encre transition-colors hover:border-encre"
              >
                {readArticle}
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
