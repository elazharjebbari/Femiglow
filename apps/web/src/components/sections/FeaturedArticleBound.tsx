import 'server-only';
import type { Article } from '@/lib/schemas';
import { FeaturedArticle } from './FeaturedArticle';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface FeaturedArticleBoundProps {
  article: Article;
}

/**
 * RSC wrapper qui résout le média à afficher pour l’article à la une.
 * Stratégie de résolution, dans l’ordre :
 *   1. Binding actif sur `journal-featured/primary` (override éditorial).
 *   2. Binding actif sur `journal-article-<slug>/cover` (cover de l’article).
 *   3. Fallback `article.featuredImage` du CMS (SVG).
 *
 * Le 2 permet de réutiliser la cover déjà seedée pour chaque article sans
 * exiger un binding dédié pour la mise en avant.
 */
export async function FeaturedArticleBound({ article }: FeaturedArticleBoundProps) {
  const featuredKey = 'journal-featured';
  const articleKey = `journal-article-${article.slug}`;

  const [featured, articleCover] = await Promise.all([
    resolveComponentSlot(featuredKey, 'primary'),
    resolveComponentSlot(articleKey, 'cover'),
  ]);

  const useFeatured = !!(featured?.binding?.isActive && featured?.media);
  const useArticleCover = !!(articleCover?.binding?.isActive && articleCover?.media);

  if (!useFeatured && !useArticleCover) {
    return <FeaturedArticle article={article} />;
  }

  const resolvedKey = useFeatured ? featuredKey : articleKey;
  const resolvedSlot = useFeatured ? 'primary' : 'cover';

  return (
    <FeaturedArticle
      article={article}
      mediaSlot={
        <ComponentMedia
          componentKey={resolvedKey}
          slot={resolvedSlot}
          context="hero"
          sizes="(min-width: 1024px) 60vw, 100vw"
          forcePriority
          altOverride={article.featuredImage.alt}
        />
      }
    />
  );
}
