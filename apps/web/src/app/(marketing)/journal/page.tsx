import type { Metadata } from 'next';
import { cms } from '@/lib/cms';
import { ArticleCardBound } from '@/components/sections/ArticleCardBound';
import { ArticleGrid } from '@/components/sections/ArticleGrid';
import { CategoryPills } from '@/components/sections/CategoryPills';
import { CrossLinkBanner } from '@/components/sections/CrossLinkBanner';
import { FeaturedArticleBound } from '@/components/sections/FeaturedArticleBound';
import { JournalHero } from '@/components/sections/JournalHero';
import { NewsletterBlock } from '@/components/sections/NewsletterBlock';
import { categoryLabels, parseCategory } from '@/lib/i18n/categories';
import { JsonLd, blogSchema } from '@/lib/seo/json-ld';
import { resolveOgImage } from '@/lib/components/og-image';

interface JournalPageProps {
  searchParams: { category?: string };
}

const FALLBACK_OG = {
  url: '/og/journal.svg',
  width: 1200,
  height: 630,
  alt: 'Le carnet de la maison',
};

export async function generateMetadata({
  searchParams,
}: JournalPageProps): Promise<Metadata> {
  const active = parseCategory(searchParams.category);
  const titleSuffix = active ? ` — ${categoryLabels[active]}` : '';
  const canonical = active ? `/journal?category=${active}` : '/journal';
  const description = active
    ? `Journal FemiGlow — articles de la catégorie ${categoryLabels[active].toLowerCase()}, écrits à Rabat.`
    : 'Le carnet de la maison FemiGlow — récits saisonniers, matières et voix d’initiées, écrits à Rabat et publiés au rythme des saisons.';
  const og = (await resolveOgImage('journal-og')) ?? FALLBACK_OG;
  return {
    title: `Le carnet de la maison${titleSuffix}`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `Le carnet de la maison${titleSuffix} — FemiGlow`,
      description,
      url: canonical,
      type: 'website',
      images: [{ url: og.url, width: og.width, height: og.height, alt: og.alt }],
    },
  };
}

export const revalidate = 1800;

export default async function JournalPage({ searchParams }: JournalPageProps) {
  const active = parseCategory(searchParams.category);
  const activeKey = active ?? 'all';

  const [featuredItems, page1] = await Promise.all([
    cms.getArticles({ limit: 1, featured: true }),
    cms.getArticlesPage({ limit: 12, category: active ?? undefined }),
  ]);

  const featured = !active ? featuredItems[0] ?? null : null;
  const grid = featured
    ? page1.items.filter((a) => a.slug !== featured.slug)
    : page1.items;
  const initialCursor = page1.nextCursor;
  const jsonLdArticles = [
    ...(featured ? [featured] : []),
    ...grid.slice(0, featured ? 2 : 3),
  ];

  // Pré-rendu RSC des cards initiales : permet à `ArticleCardBound` de
  // résoudre le binding `journal-article-<slug>/cover` côté serveur, ce que
  // `ArticleGrid` (client) ne peut pas faire seul.
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
        kicker="La maison"
        title={'L\u2019atelier de Rabat.'}
        description={'Visiter l\u2019adresse au 25 bis avenue Patrice Lumumba, comprendre comment se fabrique le rituel, rencontrer les voix qui l\u2019\u00e9crivent.'}
        ctaLabel="Visiter la maison"
        href="/maison"
        image={{
          src: '/journal/crosslink-maison.png',
          alt: 'Vue intérieure de l\u2019atelier FemiGlow à Rabat',
          width: 1600,
          height: 1067,
        }}
      />
    </>
  );
}
