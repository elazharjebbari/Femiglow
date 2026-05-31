/**
 * Page `/[locale]/journal/[slug]` — migration depuis `/journal/[slug]` legacy.
 *
 * Localise :
 *  - generateMetadata fallback title (si article introuvable)
 *  - Breadcrumb (Accueil / Journal) → traduits via navigation namespace
 *  - hreflang alternates
 *
 * Le corps de l'article (body markdown) reste dans la langue source du CMS
 * pour cette phase — Phase 3 ajoutera le fetch par locale.
 *
 * @see docs/i18n-strategy-2026-05/08-plan-action/phases.md §T2.7
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ArticleHeroBound } from '@/components/sections/ArticleHeroBound';
import { ArticleProse } from '@/components/sections/ArticleProse';
import { AuthorCard } from '@/components/sections/AuthorCard';
import {
  NewsletterBlock,
  getNewsletterBlockStringsForLocale,
} from '@/components/sections/NewsletterBlock';
import { ReadingProgress } from '@/components/sections/ReadingProgress';
import { RelatedArticlesBound } from '@/components/sections/RelatedArticlesBound';
import { ShareButtons } from '@/components/sections/ShareButtons';
import { TableOfContents } from '@/components/sections/TableOfContents';
import { ScrollDepthTracker } from '@/components/tracking/ScrollDepthTracker';
import { Container } from '@/components/ui/Container';
import { isLocale, type Locale, LOCALES } from '@/i18n.config';
import { cms } from '@/lib/cms';
import { categoryLabels } from '@/lib/i18n/categories';
import { renderMarkdown } from '@/lib/markdown/render';
import {
  blogPostingSchema,
  breadcrumbListSchema,
  JsonLd,
} from '@/lib/seo/json-ld';

const SITE_URL = 'https://femiglow-maroc.com';

interface PageProps {
  params: { locale: string; slug: string };
}

// Pré-render tous les articles × toutes les locales au build.
export async function generateStaticParams() {
  const articles = await cms.getArticles({ limit: 100 });
  return LOCALES.flatMap((locale) =>
    articles.map((a) => ({ locale, slug: a.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  if (!isLocale(params.locale)) {
    return { title: 'Article' };
  }

  const article = await cms.getArticleBySlug(params.slug, {
    locale: params.locale,
  });
  if (!article) {
    const t = await getTranslations({
      locale: params.locale,
      namespace: 'errors.404',
    });
    return { title: t('title') };
  }

  const title = article.seo.title ?? article.title;
  const description = article.seo.description ?? article.excerpt;
  const canonical = `/${params.locale}/journal/${article.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        fr: `/fr/journal/${article.slug}`,
        ar: `/ar/journal/${article.slug}`,
        en: `/en/journal/${article.slug}`,
        'x-default': `/fr/journal/${article.slug}`,
      },
    },
    openGraph: {
      type: 'article',
      title: article.seo.ogTitle ?? article.title,
      description: article.seo.ogDescription ?? article.excerpt,
      url: `${SITE_URL}${canonical}`,
      locale:
        params.locale === 'ar'
          ? 'ar_MA'
          : params.locale === 'en'
            ? 'en_US'
            : 'fr_MA',
      publishedTime: article.publishedAt.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: [article.author.name],
      section: categoryLabels[article.category],
      images: [
        {
          url: article.featuredImage.src,
          width: article.featuredImage.width,
          height: article.featuredImage.height,
          alt: article.featuredImage.alt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.seo.ogTitle ?? article.title,
      description: article.seo.ogDescription ?? article.excerpt,
      images: [article.featuredImage.src],
    },
  };
}

export const revalidate = 3600;

export default async function ArticlePage({ params }: PageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }
  const locale = params.locale as Locale;
  setRequestLocale(locale);

  const tNav = await getTranslations({ locale, namespace: 'navigation' });

  const article = await cms.getArticleBySlug(params.slug, { locale });
  if (!article) notFound();

  const [{ html, headings }, sameCategory, newsletterStrings] = await Promise.all([
    renderMarkdown(article.body),
    cms.getArticles({ category: article.category, limit: 4, locale }),
    // Phase 7E — strings du bloc newsletter localisés.
    getNewsletterBlockStringsForLocale(locale),
  ]);

  const related = sameCategory
    .filter((a) => a.slug !== article.slug)
    .slice(0, 3);

  const url = `${SITE_URL}/${locale}/journal/${article.slug}`;

  return (
    <>
      <ReadingProgress />
      <ScrollDepthTracker
        targetId="article-body"
        eventName="journal_read_75"
        contentId={article.slug}
        contentType="article"
      />
      <JsonLd data={blogPostingSchema(article)} />
      <JsonLd
        data={breadcrumbListSchema([
          { name: tNav('home'), url: `/${locale}/` },
          { name: tNav('journal'), url: `/${locale}/journal` },
          { name: article.title, url: `/${locale}/journal/${article.slug}` },
        ])}
      />

      <ArticleHeroBound article={article} locale={locale} />

      <Container width="content" className="py-12 sm:py-16">
        <div className="grid gap-12 xl:grid-cols-[1fr_220px] xl:gap-16">
          <div className="min-w-0 space-y-12">
            <ArticleProse html={html} dropCap />
            <ShareButtons url={url} title={article.title} />
            <AuthorCard author={article.author} />
          </div>
          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <TableOfContents headings={headings} />
            </div>
          </aside>
        </div>
      </Container>

      <NewsletterBlock source={`article-${article.slug}`} {...newsletterStrings} />

      <RelatedArticlesBound articles={related} locale={locale} />
    </>
  );
}
