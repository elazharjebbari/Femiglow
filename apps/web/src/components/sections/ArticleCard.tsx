import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Article } from '@/lib/schemas';
import { Heading } from '@/components/ui/Heading';
import { Image } from '@/components/ui/Image';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { categoryLabels } from '@/lib/i18n/categories';
import { routes } from '@/lib/routes';
import { formatArticleDate } from '@/lib/utils/format-date';

/**
 * Phase 7 wiring — libellés localisés de la card. Tous résolus en amont
 * (`marketing.journal.article.*`) par le wrapper RSC. Défaut FR si absent,
 * pour préserver les usages legacy + les tests qui rendent sans strings.
 */
export interface ArticleCardStrings {
  /** Catégorie déjà localisée (override de `categoryLabels[category]`). */
  categoryLabel?: string;
  /** Durée de lecture déjà interpolée (`{min} min de lecture`). */
  readingTime: string;
  /** aria-label déjà interpolé (`Lire « {title} » — {category}`). */
  readAriaLabel: string;
}

interface ArticleCardProps {
  article: Article;
  priority?: boolean;
  sizes?: string;
  headingLevel?: 'h2' | 'h3';
  /** Slot media déjà résolu (Component-Media). Remplace `featuredImage`. */
  mediaSlot?: ReactNode;
  /** Phase 7 wiring — libellés localisés. Défaut FR si absent. */
  strings?: ArticleCardStrings;
  /** Phase 9 i18n — locale active pour le format de date. Défaut FR. */
  locale?: string;
}

export function ArticleCard({
  article,
  priority = false,
  sizes = '(min-width: 1024px) 33vw, (min-width: 720px) 50vw, 100vw',
  headingLevel = 'h3',
  mediaSlot,
  strings,
  locale,
}: ArticleCardProps) {
  const categoryLabel = strings?.categoryLabel ?? categoryLabels[article.category];
  const readingTime =
    strings?.readingTime ?? `${article.readingTimeMinutes} min de lecture`;
  const readAriaLabel =
    strings?.readAriaLabel ?? `Lire « ${article.title} » — ${categoryLabel}`;
  return (
    <article className="group flex flex-col gap-4">
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
            ratio="4:5"
            sizes={sizes}
            priority={priority}
          />
        )}
      </Link>
      <div className="space-y-2">
        <Kicker>{categoryLabel}</Kicker>
        <Heading as={headingLevel} size="md">
          <Link href={routes.article(article.slug)} className="hover:text-encre/80">
            {article.title}
          </Link>
        </Heading>
        <Text size="small" tone="secondary">
          {article.excerpt}
        </Text>
        <Text size="caption" tone="tertiary" className="pt-1">
          <time dateTime={article.publishedAt.toISOString()}>
            {formatArticleDate(article.publishedAt, locale)}
          </time>
          <span aria-hidden="true"> · </span>
          {readingTime}
        </Text>
      </div>
    </article>
  );
}
