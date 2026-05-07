import 'server-only';
import type { ReactNode } from 'react';
import type { Article } from '@/lib/schemas';
import { JournalExtraits } from './JournalExtraits';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

interface JournalExtraitsBoundProps {
  articles: Article[];
  kicker?: string;
  title?: string;
}

/**
 * RSC wrapper qui pré-résout les bindings `journal-article-{slug}/cover`
 * pour les articles affichés dans `JournalExtraits` (1 hero + 2 minis).
 *
 * On résout en parallèle pour éviter les waterfalls. Si aucun binding actif
 * sur un article donné → on omet la clé du `mediaSlots` et le composant
 * fallback sur `featuredImage` du CMS.
 */
export async function JournalExtraitsBound({
  articles,
  kicker,
  title,
}: JournalExtraitsBoundProps) {
  const visibles = articles.slice(0, 3);

  const resolutions = await Promise.all(
    visibles.map(async (article) => {
      const componentKey = `journal-article-${article.slug}`;
      const resolved = await resolveComponentSlot(componentKey, 'cover');
      const useBinding = !!(resolved?.binding?.isActive && resolved?.media);
      return { article, componentKey, useBinding };
    }),
  );

  const mediaSlots: Record<string, ReactNode> = {};
  for (const { article, componentKey, useBinding } of resolutions) {
    if (!useBinding) continue;
    const isHeroCard = article.slug === visibles[0]?.slug;
    mediaSlots[article.slug] = (
      <ComponentMedia
        componentKey={componentKey}
        slot="cover"
        context="inline"
        sizes={
          isHeroCard
            ? '(min-width: 1024px) 60vw, (min-width: 720px) 90vw, 100vw'
            : '160px'
        }
        className={
          isHeroCard
            ? 'transition-opacity duration-base group-hover:opacity-95'
            : 'transition-opacity duration-base group-hover:opacity-95'
        }
        altOverride={article.featuredImage.alt}
      />
    );
  }

  return (
    <JournalExtraits
      articles={articles}
      kicker={kicker}
      title={title}
      mediaSlots={mediaSlots}
    />
  );
}
