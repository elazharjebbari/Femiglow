import type { MetadataRoute } from 'next';
import { cms } from '@/lib/cms';
import { env } from '@/lib/env';
import { routes } from '@/lib/routes';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}${routes.home}`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}${routes.rituel}`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}${routes.kit}`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}${routes.journal}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}${routes.maison}`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}${routes.contact}`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ];

  const articles = await cms.getArticles({ limit: 100 });
  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${base}${routes.article(article.slug)}`,
    lastModified: article.updatedAt ?? article.publishedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticEntries, ...articleEntries];
}
