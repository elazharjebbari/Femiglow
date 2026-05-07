import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Article } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Image } from '@/components/ui/Image';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/utils/cn';

interface JournalExtraitsProps {
  articles: Article[];
  kicker?: string;
  title?: string;
  /**
   * Slot media résolu côté serveur (Component-Media), indexé par
   * `article.slug`. Si présent, remplace l'`<Image src={featuredImage}>`.
   */
  mediaSlots?: Record<string, ReactNode>;
}

const categoryLabels: Record<Article['category'], string> = {
  maison: 'Maison',
  saison: 'Saison',
  voix: 'Voix',
  matieres: 'Matières',
  pratique: 'Pratique',
};

export function JournalExtraits({
  articles,
  kicker = 'Le journal',
  title = 'Lettres saisonnières.',
  mediaSlots,
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
            Lire le journal
          </Link>
        </div>

        <div className="grid gap-10 lg:grid-cols-5">
          <ArticleHeroCard
            article={hero}
            mediaSlot={mediaSlots?.[hero.slug]}
            className="lg:col-span-3"
          />
          <div className="flex flex-col gap-10 lg:col-span-2">
            {secondaires.map((article) => (
              <ArticleMiniCard
                key={article.slug}
                article={article}
                mediaSlot={mediaSlots?.[article.slug]}
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
}

function ArticleHeroCard({ article, className, mediaSlot }: ArticleCardProps) {
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
        <Kicker tone="champagne">
          {categoryLabels[article.category]} · {article.readingTimeMinutes}&nbsp;min
        </Kicker>
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

function ArticleMiniCard({ article, mediaSlot }: ArticleCardProps) {
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
