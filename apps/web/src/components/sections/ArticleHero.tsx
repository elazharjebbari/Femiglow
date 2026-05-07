import type { ReactNode } from 'react';
import type { Article } from '@/lib/schemas';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Image } from '@/components/ui/Image';
import { Kicker } from '@/components/ui/Kicker';
import { categoryLabels } from '@/lib/i18n/categories';
import { ArticleMeta } from './ArticleMeta';

interface ArticleHeroProps {
  article: Article;
  /** Slot media déjà résolu (Component-Media). Remplace `featuredImage`. */
  mediaSlot?: ReactNode;
}

export function ArticleHero({ article, mediaSlot }: ArticleHeroProps) {
  const categoryLabel = categoryLabels[article.category];
  return (
    <header className="bg-creme">
      <div className="w-full">
        {mediaSlot ?? (
          <Image
            src={article.featuredImage.src}
            alt={article.featuredImage.alt}
            width={article.featuredImage.width}
            height={article.featuredImage.height}
            ratio="16:9"
            priority
            sizes="100vw"
            className="w-full"
          />
        )}
      </div>
      <Container width="prose" className="py-12 sm:py-16">
        <div className="space-y-5">
          <Kicker>{categoryLabel}</Kicker>
          <Heading as="h1" size="display-md" italic="auto" balance>
            {article.title}
          </Heading>
          <ArticleMeta
            author={article.author}
            publishedAt={article.publishedAt}
            readingTimeMinutes={article.readingTimeMinutes}
          />
        </div>
      </Container>
    </header>
  );
}
