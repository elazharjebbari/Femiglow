import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Article } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Image } from '@/components/ui/Image';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/utils/cn';

/**
 * Phase 9 i18n — libellés localisés. Défaut FR si absent (préserve legacy +
 * tests). `categoryLabels` override la map FR ; `readingTime` est un gabarit
 * avec `{min}` ; `cta` remplace « Lire le journal ».
 */
export interface JournalExtraitsStrings {
  cta: string;
  categoryLabels: Record<Article['category'], string>;
  /** Gabarit avec `{min}` (ex. « {min} دقائق قراءة »). */
  readingTime: string;
}

interface JournalExtraitsProps {
  articles: Article[];
  kicker?: string;
  title?: string;
  /**
   * Slot media résolu côté serveur (Component-Media), indexé par
   * `article.slug`. Si présent, remplace l'`<Image src={featuredImage}>`.
   */
  mediaSlots?: Record<string, ReactNode>;
  /** Phase 9 i18n — libellés localisés. Défaut FR. */
  strings?: JournalExtraitsStrings;
}

const DEFAULT_CATEGORY_LABELS: Record<Article['category'], string> = {
  maison: 'Maison',
  saison: 'Saison',
  voix: 'Voix',
  matieres: 'Matières',
  pratique: 'Pratique',
};

const DEFAULT_STRINGS: JournalExtraitsStrings = {
  cta: 'Lire le journal',
  categoryLabels: DEFAULT_CATEGORY_LABELS,
  readingTime: '{min} min',
};

export function JournalExtraits({
  articles,
  kicker = 'Le journal',
  title = 'Lettres saisonnières.',
  mediaSlots,
  strings = DEFAULT_STRINGS,
}: JournalExtraitsProps) {
  if (articles.length === 0) return null;
  const [hero, ...rest] = articles;
  const secondaires = rest.slice(0, 2);
  if (!hero) return null;

  return (
    <section className="py-20 sm:py-24" aria-labelledby="journal-extraits-title">
      <Container width="wide">
        <div className="mb-12 flex flex-col gap-3 sm:mb-16 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Kicker tone="champagne" withRule>
              {kicker}
            </Kicker>
            <Heading
              as="h2"
              size="display-md"
              italic="always"
              id="journal-extraits-title"
            >
              {title}
            </Heading>
          </div>
          <Link
            href="/journal"
            className="self-start text-sm uppercase tracking-[0.18em] text-encre underline-offset-4 hover:underline sm:self-auto"
          >
            {strings.cta}
          </Link>
        </div>

        <div className="grid gap-10 lg:grid-cols-5">
          <ArticleHeroCard
            article={hero}
            mediaSlot={mediaSlots?.[hero.slug]}
            className="lg:col-span-3"
            strings={strings}
          />
          <div className="flex flex-col gap-10 lg:col-span-2">
            {secondaires.map((article) => (
              <ArticleMiniCard
                key={article.slug}
                article={article}
                mediaSlot={mediaSlots?.[article.slug]}
                strings={strings}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

interface ArticleCardProps {
  article: Article;
  className?: string;
  mediaSlot?: ReactNode;
  strings: JournalExtraitsStrings;
}

/** Rend le kicker « Catégorie · X min » localisé. */
function categoryMeta(article: Article, strings: JournalExtraitsStrings): string {
  const cat = strings.categoryLabels[article.category];
  const rt = strings.readingTime.replace(
    '{min}',
    String(article.readingTimeMinutes),
  );
  return `${cat} · ${rt}`;
}

function ArticleHeroCard({ article, className, mediaSlot, strings }: ArticleCardProps) {
  return (
    <article className={cn('group flex flex-col gap-5', className)}>
      <Link href={`/journal/${article.slug}`} className="block">
        {mediaSlot ?? (
          <Image
            src={article.featuredImage.src}
            alt={article.featuredImage.alt}
            width={article.featuredImage.width}
            height={article.featuredImage.height}
            ratio="4:3"
            rounded
            sizes="(min-width: 1024px) 60vw, (min-width: 720px) 90vw, 100vw"
            className="transition-opacity duration-base group-hover:opacity-95"
          />
        )}
      </Link>
      <div className="space-y-3">
        <Kicker tone="champagne">{categoryMeta(article, strings)}</Kicker>
        <Heading as="h3" size="display-sm" italic="never">
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

function ArticleMiniCard({ article, mediaSlot, strings }: ArticleCardProps) {
  return (
    <article className="group flex gap-5">
      <Link
        href={`/journal/${article.slug}`}
        className="block w-32 flex-none sm:w-40"
      >
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
        <Kicker tone="champagne">{categoryMeta(article, strings)}</Kicker>
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
