import 'server-only';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import type { Article } from '@/lib/schemas';
import { JournalExtraits, type JournalExtraitsStrings } from './JournalExtraits';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';

interface JournalExtraitsBoundProps {
  articles: Article[];
  kicker?: string;
  title?: string;
  /** Phase 9 i18n — locale active pour résoudre kicker/title/cta/catégories. */
  locale?: Locale;
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
  locale,
}: JournalExtraitsBoundProps) {
  const visibles = articles.slice(0, 3);
  const activeLocale = locale ?? DEFAULT_LOCALE;

  // Phase 9 i18n — kicker/title/cta + catégories + durée de lecture localisés.
  const [tHome, tArticle, tCategories] = await Promise.all([
    getTranslations({ locale: activeLocale, namespace: 'marketing.home.journal' }),
    getTranslations({ locale: activeLocale, namespace: 'marketing.journal.article' }),
    getTranslations({ locale: activeLocale, namespace: 'marketing.journal.categories' }),
  ]);

  const resolvedKicker = kicker ?? tHome('kicker');
  const resolvedTitle = title ?? tHome('title');
  const strings: JournalExtraitsStrings = {
    cta: tHome('cta'),
    categoryLabels: {
      maison: tCategories('maison'),
      saison: tCategories('saison'),
      voix: tCategories('voix'),
      matieres: tCategories('matieres'),
      pratique: tCategories('pratique'),
    },
    // Gabarit ICU `{min}` ré-émis tel quel → substitution côté composant.
    readingTime: tArticle('reading_time', { min: '{min}' }),
  };

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
      kicker={resolvedKicker}
      title={resolvedTitle}
      mediaSlots={mediaSlots}
      strings={strings}
    />
  );
}
