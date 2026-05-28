/**
 * Page `/[locale]/journal` — migration depuis `/journal` legacy.
 *
 * - Localise `generateMetadata` (title varie selon catégorie active)
 * - Localise le CrossLinkBanner (kicker/title/description/cta/alt)
 * - Préserve la logique filtres catégories + featured + pagination
 * - Composants Bound (FeaturedArticleBound, ArticleCardBound) restent
 *   pour Phase 3 CMS multilingue
 *
 * @see docs/i18n-strategy-2026-05/08-plan-action/phases.md §T2.6
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ArticleCardBound } from '@/components/sections/ArticleCardBound';
import { ArticleGrid } from '@/components/sections/ArticleGrid';
import { CategoryPills } from '@/components/sections/CategoryPills';
import { CrossLinkBanner } from '@/components/sections/CrossLinkBanner';
import { FeaturedArticleBound } from '@/components/sections/FeaturedArticleBound';
import { JournalHero } from '@/components/sections/JournalHero';
import { NewsletterBlock } from '@/components/sections/NewsletterBlock';
import { isLocale, type Locale } from '@/i18n.config';
import { cms } from '@/lib/cms';
import { resolveOgImage } from '@/lib/components/og-image';
import { categoryLabels, parseCategory } from '@/lib/i18n/categories';
import { JsonLd, blogSchema } from '@/lib/seo/json-ld';

const FALLBACK_OG = {
  url: '/og/journal.svg',
  width: 1200,
  height: 630,
  alt: 'Le carnet de la maison',
};

interface PageProps {
  params: { locale: string };
  searchParams: { category?: string };
}

// ---------------------------------------------------------------------------
// generateMetadata — SEO localisé avec catégorie active dans le title
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  if (!isLocale(params.locale)) {
    return { title: 'Journal' };
  }
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'marketing.journal.metadata',
  });

  const active = parseCategory(searchParams.category);
  const titleSuffix = active ? ` — ${categoryLabels[active]}` : '';
  const canonical = active
    ? `/${params.locale}/journal?category=${active}`
    : `/${params.locale}/journal`;
  const description = active ? t('description_filtered') : t('description_default');
  const og = (await resolveOgImage('journal-og')) ?? FALLBACK_OG;

  return {
    title: `${t('title_base')}${titleSuffix}`,
    description,
    alternates: {
      canonical,
      languages: {
        fr: active ? `/fr/journal?category=${active}` : '/fr/journal',
        ar: active ? `/ar/journal?category=${active}` : '/ar/journal',
        en: active ? `/en/journal?category=${active}` : '/en/journal',
        'x-default': active ? `/fr/journal?category=${active}` : '/fr/journal',
      },
    },
    openGraph: {
      title: `${t('title_base')}${titleSuffix} — FemiGlow`,
      description,
      url: canonical,
      type: 'website',
      locale:
        params.locale === 'ar'
          ? 'ar_MA'
          : params.locale === 'en'
            ? 'en_US'
            : 'fr_MA',
      images: [{ url: og.url, width: og.width, height: og.height, alt: og.alt }],
    },
  };
}

export const revalidate = 1800;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function JournalPage({ params, searchParams }: PageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }
  const locale = params.locale as Locale;
  setRequestLocale(locale);

  const tCross = await getTranslations({
    locale,
    namespace: 'marketing.journal.cross.maison',
  });

  const active = parseCategory(searchParams.category);
  const activeKey = active ?? 'all';

  const [featuredItems, page1] = await Promise.all([
    cms.getArticles({ limit: 1, featured: true, locale }),
    cms.getArticlesPage({ limit: 12, category: active ?? undefined, locale }),
  ]);

  const featured = !active ? (featuredItems[0] ?? null) : null;
  const grid = featured
    ? page1.items.filter((a) => a.slug !== featured.slug)
    : page1.items;
  const initialCursor = page1.nextCursor;
  const jsonLdArticles = [
    ...(featured ? [featured] : []),
    ...grid.slice(0, featured ? 2 : 3),
  ];

  const cardHeadingLevel = featured ? 'h3' : 'h2';
  const initialCards = grid.map((article) => (
    <ArticleCardBound
      key={article.slug}
      article={article}
      headingLevel={cardHeadingLevel}
    />
  ));

  return (
    <>
      <JsonLd data={blogSchema(jsonLdArticles)} />
      <JournalHero />
      {featured && <FeaturedArticleBound article={featured} />}
      <div className="bg-creme pt-12 sm:pt-16">
        <CategoryPills active={activeKey} />
      </div>
      <ArticleGrid
        initialArticles={grid}
        initialCards={initialCards}
        initialCursor={initialCursor}
        category={activeKey}
        cardHeadingLevel={cardHeadingLevel}
      />
      <NewsletterBlock source="journal-bottom" />
      <CrossLinkBanner
        kicker={tCross('kicker')}
        title={tCross('title')}
        description={tCross('description')}
        ctaLabel={tCross('cta')}
        href={`/${locale}/maison`}
        image={{
          src: '/journal/crosslink-maison.png',
          alt: tCross('image_alt'),
          width: 1600,
          height: 1067,
        }}
      />
    </>
  );
}
