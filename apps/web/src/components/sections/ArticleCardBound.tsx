import 'server-only';
import type { Article } from '@/lib/schemas';
import { ArticleCard } from './ArticleCard';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface ArticleCardBoundProps {
  article: Article;
  priority?: boolean;
  sizes?: string;
  headingLevel?: 'h2' | 'h3';
}

/**
 * RSC wrapper qui résout le slot 'cover' du composant
 * `journal-article-{slug}` et délègue à ArticleCard.
 *
 * Si pas de binding actif → ArticleCard utilise `article.featuredImage` du CMS.
 */
export async function ArticleCardBound({
  article,
  priority,
  sizes,
  headingLevel,
}: ArticleCardBoundProps) {
  const componentKey = `journal-article-${article.slug}`;
  const resolved = await resolveComponentSlot(componentKey, 'cover');
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding) {
    return (
      <ArticleCard
        article={article}
        priority={priority}
        sizes={sizes}
        headingLevel={headingLevel}
      />
    );
  }

  return (
    <ArticleCard
      article={article}
      priority={priority}
      sizes={sizes}
      headingLevel={headingLevel}
      mediaSlot={
        <ComponentMedia
          componentKey={componentKey}
          slot="cover"
          context="inline"
          sizes={sizes}
          forcePriority={priority}
          className="transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:-translate-y-1"
        />
      }
    />
  );
}
