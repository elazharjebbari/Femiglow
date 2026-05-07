import 'server-only';
import type { Article } from '@/lib/schemas';
import { ArticleHero } from './ArticleHero';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface ArticleHeroBoundProps {
  article: Article;
}

/**
 * RSC wrapper qui résout le slot `journal-article-{slug}/cover` et délègue
 * à `ArticleHero`. Si aucun binding actif → fallback CMS featuredImage.
 */
export async function ArticleHeroBound({ article }: ArticleHeroBoundProps) {
  const componentKey = `journal-article-${article.slug}`;
  const resolved = await resolveComponentSlot(componentKey, 'cover');
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);

  if (!useBinding) {
    return <ArticleHero article={article} />;
  }

  return (
    <ArticleHero
      article={article}
      mediaSlot={
        <ComponentMedia
          componentKey={componentKey}
          slot="cover"
          context="hero"
          sizes="100vw"
          forcePriority
          altOverride={article.featuredImage.alt}
          className="w-full"
        />
      }
    />
  );
}
