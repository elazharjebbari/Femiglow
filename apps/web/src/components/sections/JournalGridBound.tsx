import 'server-only';
import type { ReactNode } from 'react';
import type { Article } from '@/lib/schemas';
import { JournalGrid } from './JournalGrid';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface JournalGridBoundProps {
  articles: Article[];
  kicker?: string;
  title?: string;
  ctaLabel?: string;
  variant?: 'symmetric' | 'asymmetric';
  limit?: number;
  /** Phase 9bis — libellés de catégorie localisés. */
  categoryLabels?: Record<Article['category'], string>;
}

/**
 * RSC wrapper qui pré-résout les bindings `journal-article-{slug}/cover` pour
 * les articles affichés dans `JournalGrid` (utilisé sur `/rituel` et `/kit`).
 *
 * Résolution parallèle pour éviter les waterfalls. Si aucun binding actif sur
 * un article donné → on omet la clé du `mediaSlots` et `JournalGrid` fallback
 * sur `featuredImage` du CMS (SVG).
 */
export async function JournalGridBound({
  articles,
  kicker,
  title,
  ctaLabel,
  variant = 'symmetric',
  limit,
  categoryLabels,
}: JournalGridBoundProps) {
  const visibles = limit ? articles.slice(0, limit) : articles;

  const resolutions = await Promise.all(
    visibles.map(async (article) => {
      const componentKey = `journal-article-${article.slug}`;
      const resolved = await resolveComponentSlot(componentKey, 'cover');
      const useBinding = !!(resolved?.binding?.isActive && resolved?.media);
      return { article, componentKey, useBinding };
    }),
  );

  const mediaSlots: Record<string, ReactNode> = {};
  // Variante asymétrique : 1 hero (ratio 4:3, sizes ~60vw) + 2 minis (ratio 1:1, sizes 160px).
  // Variante symétrique : N cards (ratio 4:5, sizes ~30vw).
  const heroSlug = variant === 'asymmetric' ? visibles[0]?.slug : undefined;
  for (const { article, componentKey, useBinding } of resolutions) {
    if (!useBinding) continue;
    const isHero = article.slug === heroSlug;
    const isMini = variant === 'asymmetric' && !isHero;
    mediaSlots[article.slug] = (
      <ComponentMedia
        componentKey={componentKey}
        slot="cover"
        context="inline"
        sizes={
          isHero
            ? '(min-width: 1024px) 60vw, (min-width: 720px) 90vw, 100vw'
            : isMini
              ? '160px'
              : '(min-width: 1024px) 30vw, (min-width: 720px) 45vw, 100vw'
        }
        className="transition-opacity duration-base group-hover:opacity-95"
        altOverride={article.featuredImage.alt}
      />
    );
  }

  return (
    <JournalGrid
      articles={articles}
      kicker={kicker}
      title={title}
      ctaLabel={ctaLabel}
      variant={variant}
      limit={limit}
      mediaSlots={mediaSlots}
      categoryLabels={categoryLabels}
    />
  );
}
