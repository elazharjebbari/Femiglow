import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cms } from '@/lib/cms';
import { ArticleHeroBound } from '@/components/sections/ArticleHeroBound';
import { ArticleProse } from '@/components/sections/ArticleProse';
import { AuthorCard } from '@/components/sections/AuthorCard';
import { Container } from '@/components/ui/Container';
import { NewsletterBlock } from '@/components/sections/NewsletterBlock';
import { ReadingProgress } from '@/components/sections/ReadingProgress';
import { RelatedArticlesBound } from '@/components/sections/RelatedArticlesBound';
import { ShareButtons } from '@/components/sections/ShareButtons';
import { TableOfContents } from '@/components/sections/TableOfContents';
import { ScrollDepthTracker } from '@/components/tracking/ScrollDepthTracker';
import { categoryLabels } from '@/lib/i18n/categories';
import { renderMarkdown } from '@/lib/markdown/render';
import {
  JsonLd,
  blogPostingSchema,
  breadcrumbListSchema,
} from '@/lib/seo/json-ld';

interface Params {
  params: { slug: string };
}

const SITE_URL = 'https://femiglow.ma';

export async function generateStaticParams() {
  const articles = await cms.getArticles({ limit: 100 });
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const article = await cms.getArticleBySlug(params.slug);
  if (!article) return { title: 'Article introuvable' };

  const title = article.seo.title ?? article.title;
  const description = article.seo.description ?? article.excerpt;
  const canonical = `/journal/${article.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title: article.seo.ogTitle ?? article.title,
      description: article.seo.ogDescription ?? article.excerpt,
      url: `${SITE_URL}${canonical}`,
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

export default async function ArticlePage({ params }: Params) {
  const article = await cms.getArticleBySlug(params.slug);
  if (!article) notFound();

  const [{ html, headings }, sameCategory] = await Promise.all([
    renderMarkdown(article.body),
    cms.getArticles({ category: article.category, limit: 4 }),
  ]);

  const related = sameCategory
    .filter((a) => a.slug !== article.slug)
    .slice(0, 3);

  const url = `${SITE_URL}/journal/${article.slug}`;

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
          { name: 'Accueil', url: '/' },
          { name: 'Journal', url: '/journal' },
          { name: article.title, url: `/journal/${article.slug}` },
        ])}
      />

      <ArticleHeroBound article={article} />

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

      <NewsletterBlock source={`article-${article.slug}`} />

      <RelatedArticlesBound articles={related} />
    </>
  );
}
