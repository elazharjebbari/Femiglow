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

interface FeaturedArticleProps {
  article: Article;
  /** Slot media déjà résolu (Component-Media). Remplace `featuredImage`. */
  mediaSlot?: ReactNode;
}

export function FeaturedArticle({ article, mediaSlot }: FeaturedArticleProps) {
  const categoryLabel = categoryLabels[article.category];
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
              aria-label={`Lire l\u2019article \u00e0 la une : ${article.title}`}
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
                à la une
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
                {formatArticleDate(article.publishedAt)}
              </time>
              <span aria-hidden="true"> · </span>
              {article.readingTimeMinutes}&nbsp;min de lecture
            </Text>
            <p className="pt-2">
              <Link
                href={routes.article(article.slug)}
                className="inline-flex items-center gap-2 border-b border-encre/40 pb-1 font-body text-sm uppercase tracking-[0.2em] text-encre transition-colors hover:border-encre"
              >
                Lire l&rsquo;article
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
