import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Article } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Image } from '@/components/ui/Image';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/utils/cn';

type Variant = 'symmetric' | 'asymmetric';

interface JournalGridProps {
  articles: Article[];
  kicker?: string;
  title?: string;
  ctaLabel?: string;
  variant?: Variant;
  limit?: number;
  /**
   * Slot media résolu côté serveur (Component-Media), indexé par
   * `article.slug`. Si présent, remplace l'`<Image src={featuredImage}>`.
   * Typiquement fourni par `JournalGridBound`.
   */
  mediaSlots?: Record<string, ReactNode>;
  /**
   * Phase 9bis — libellés de catégorie localisés (« Maison », « Voix »…).
   * Défaut FR. Fournis par `JournalGridBound` depuis `marketing.journal.categories`.
   */
  categoryLabels?: Record<Article['category'], string>;
}

const DEFAULT_CATEGORY_LABELS: Record<Article['category'], string> = {
  maison: 'Maison',
  saison: 'Saison',
  voix: 'Voix',
  matieres: 'Matières',
  pratique: 'Pratique',
};

export function JournalGrid({
  articles,
  kicker = 'Le journal',
  title = 'Lettres saisonnières.',
  ctaLabel = 'Lire le journal',
  variant = 'symmetric',
  limit,
  mediaSlots,
  categoryLabels = DEFAULT_CATEGORY_LABELS,
}: JournalGridProps) {
  const visible = limit ? articles.slice(0, limit) : articles;
  if (visible.length === 0) return null;

  return (
    <section className="bg-creme py-20 sm:py-24" aria-labelledby="journal-grid-title">
      <Container width="wide">
        <div className="mb-12 flex flex-col gap-3 sm:mb-16 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Kicker tone="champagne" withRule>
              {kicker}
            </Kicker>
            <Heading as="h2" size="display-md" italic="always" id="journal-grid-title">
              {title}
            </Heading>
          </div>
          <Link
            href="/journal"
            className="self-start text-sm uppercase tracking-[0.18em] text-encre underline-offset-4 hover:underline sm:self-auto"
          >
            {ctaLabel}
          </Link>
        </div>

        {variant === 'asymmetric' ? (
          <AsymmetricLayout
            articles={visible}
            mediaSlots={mediaSlots}
            categoryLabels={categoryLabels}
          />
        ) : (
          <SymmetricLayout
            articles={visible}
            mediaSlots={mediaSlots}
            categoryLabels={categoryLabels}
          />
        )}
      </Container>
    </section>
  );
}

interface LayoutProps {
  articles: Article[];
  mediaSlots?: Record<string, ReactNode>;
  categoryLabels: Record<Article['category'], string>;
}

function SymmetricLayout({ articles, mediaSlots, categoryLabels }: LayoutProps) {
  return (
    <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12">
      {articles.map((article) => (
        <ArticleCard
          key={article.slug}
          article={article}
          mediaSlot={mediaSlots?.[article.slug]}
          categoryLabels={categoryLabels}
        />
      ))}
    </div>
  );
}

function AsymmetricLayout({ articles, mediaSlots, categoryLabels }: LayoutProps) {
  const [hero, ...rest] = articles;
  if (!hero) return null;
  return (
    <div className="grid gap-10 lg:grid-cols-5">
      <ArticleCard
        article={hero}
        variant="hero"
        className="lg:col-span-3"
        mediaSlot={mediaSlots?.[hero.slug]}
        categoryLabels={categoryLabels}
      />
      <div className="flex flex-col gap-10 lg:col-span-2">
        {rest.slice(0, 2).map((article) => (
          <ArticleMiniCard
            key={article.slug}
            article={article}
            mediaSlot={mediaSlots?.[article.slug]}
            categoryLabels={categoryLabels}
          />
        ))}
      </div>
    </div>
  );
}

interface ArticleCardProps {
  article: Article;
  variant?: 'card' | 'hero';
  className?: string;
  mediaSlot?: ReactNode;
  categoryLabels: Record<Article['category'], string>;
}

function ArticleCard({ article, variant = 'card', className, mediaSlot, categoryLabels }: ArticleCardProps) {
  const ratio = variant === 'hero' ? '4:3' : '4:5';
  const headingSize = variant === 'hero' ? 'display-sm' : 'sm';
  return (
    <article className={cn('group flex flex-col gap-5', className)}>
      <Link href={`/journal/${article.slug}`} className="block">
        {mediaSlot ?? (
          <Image
            src={article.featuredImage.src}
            alt={article.featuredImage.alt}
            width={article.featuredImage.width}
            height={article.featuredImage.height}
            ratio={ratio}
            rounded
            sizes={
              variant === 'hero'
                ? '(min-width: 1024px) 60vw, (min-width: 720px) 90vw, 100vw'
                : '(min-width: 1024px) 30vw, (min-width: 720px) 45vw, 100vw'
            }
            className="transition-opacity duration-base group-hover:opacity-95"
          />
        )}
      </Link>
      <div className="space-y-3">
        <Kicker tone="champagne">
          {categoryLabels[article.category]} · {article.readingTimeMinutes}&nbsp;min
        </Kicker>
        <Heading as="h3" size={headingSize} italic="never">
          <Link
            href={`/journal/${article.slug}`}
            className="underline-offset-4 hover:underline"
          >
            {article.title}
          </Link>
        </Heading>
        <Text size="body" tone="secondary" prose>
          {article.excerpt}
        </Text>
      </div>
    </article>
  );
}

function ArticleMiniCard({
  article,
  mediaSlot,
  categoryLabels,
}: {
  article: Article;
  mediaSlot?: ReactNode;
  categoryLabels: Record<Article['category'], string>;
}) {
  return (
    <article className="group flex gap-5">
      <Link href={`/journal/${article.slug}`} className="block w-32 flex-none sm:w-40">
        {mediaSlot ?? (
          <Image
            src={article.featuredImage.src}
            alt={article.featuredImage.alt}
            width={article.featuredImage.width}
            height={article.featuredImage.height}
            ratio="1:1"
            rounded
            sizes="160px"
            className="transition-opacity duration-base group-hover:opacity-95"
          />
        )}
      </Link>
      <div className="flex flex-1 flex-col justify-center gap-2">
        <Kicker tone="champagne">
          {categoryLabels[article.category]} · {article.readingTimeMinutes}&nbsp;min
        </Kicker>
        <Heading as="h3" size="sm" italic="never">
          <Link
            href={`/journal/${article.slug}`}
            className="underline-offset-4 hover:underline"
          >
            {article.title}
          </Link>
        </Heading>
      </div>
    </article>
  );
}
