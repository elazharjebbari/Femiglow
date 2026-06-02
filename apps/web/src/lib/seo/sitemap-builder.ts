/**
 * Construction partagée des sitemaps FemiGlow.
 *
 * Deux consommateurs :
 *  - `app/sitemap.ts` → `/sitemap.xml` : TOUTES les langues (FR+AR+EN) + légal.
 *  - `app/[locale]/sitemap.xml/route.ts` → `/[lang]/sitemap.xml` : UNE langue
 *    (les `<loc>` ne portent que les chemins de cette langue ; le légal n'est
 *    inclus qu'en FR, langue par défaut).
 *
 * Dans tous les cas, chaque entrée porte les alternates hreflang `fr/ar/en` +
 * `x-default` (→ FR) — recommandation Google (chaque variante référence toutes
 * les variantes), indépendamment du périmètre des `<loc>`.
 */
import type { MetadataRoute } from 'next';

import { cms } from '@/lib/cms';
import { env } from '@/lib/env';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/i18n.config';
import { listPublishedSearchablePages } from '@/lib/legal/repository';
import { routes } from '@/lib/routes';

export function sitemapBase(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
}

function getBuildDate(): Date {
  const raw = process.env.NEXT_PUBLIC_BUILD_DATE;
  if (!raw) return new Date(0);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

/**
 * URL localisée d'un chemin canonique : préfixe `/[locale]` pour TOUTES les
 * locales (FR inclus), comme les hreflang émis par les pages `[locale]/*`. Le
 * chemin racine `/` devient `/[locale]/`.
 */
export function localizedPath(locale: string, path: string): string {
  return path === '/' ? `/${locale}/` : `/${locale}${path}`;
}

function alternatesFor(base: string, path: string): {
  languages: Record<string, string>;
} {
  const languages: Record<string, string> = {};
  for (const loc of LOCALES) languages[loc] = `${base}${localizedPath(loc, path)}`;
  languages['x-default'] = `${base}${localizedPath(DEFAULT_LOCALE, path)}`;
  return { languages };
}

interface SitemapPage {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
  lastModified: Date | string;
}

/** Pages localisables (déclinées FR/AR/EN) : statiques marketing + articles. */
async function collectLocalizablePages(): Promise<SitemapPage[]> {
  const buildDate = getBuildDate();
  const pages: SitemapPage[] = [
    { path: routes.home, changeFrequency: 'weekly', priority: 1, lastModified: buildDate },
    { path: routes.rituel, changeFrequency: 'monthly', priority: 0.9, lastModified: buildDate },
    { path: routes.kit, changeFrequency: 'weekly', priority: 0.9, lastModified: buildDate },
    { path: routes.journal, changeFrequency: 'weekly', priority: 0.8, lastModified: buildDate },
    { path: routes.maison, changeFrequency: 'monthly', priority: 0.7, lastModified: buildDate },
    { path: routes.contact, changeFrequency: 'yearly', priority: 0.4, lastModified: buildDate },
  ];
  try {
    const articles = await cms.getArticles({ limit: 100 });
    for (const article of articles) {
      pages.push({
        path: routes.article(article.slug),
        changeFrequency: 'monthly',
        priority: 0.6,
        lastModified: article.updatedAt ?? article.publishedAt,
      });
    }
  } catch {
    // CMS indisponible → on garde au moins les statiques (pas de 500).
  }
  return pages;
}

/** Pages légales searchable — non traduites (FR racine `/legal/<slug>`). */
async function collectLegalEntries(base: string): Promise<MetadataRoute.Sitemap> {
  try {
    const pages = await listPublishedSearchablePages();
    return pages.map((p) => ({
      url: `${base}/legal/${p.slug}`,
      lastModified: p.publishedAt ?? p.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    }));
  } catch {
    return [];
  }
}

/**
 * Construit les entrées sitemap.
 * @param locUrlLocales langues dont les chemins apparaissent en `<loc>`.
 * @param includeLegal  inclure les pages légales FR (true pour `/sitemap.xml`
 *                      et `/fr/sitemap.xml` ; false pour `/ar` et `/en`).
 */
export async function buildSitemapEntries(opts: {
  locUrlLocales: readonly Locale[];
  includeLegal: boolean;
}): Promise<MetadataRoute.Sitemap> {
  const base = sitemapBase();
  const pages = await collectLocalizablePages();
  const entries: MetadataRoute.Sitemap = [];
  for (const page of pages) {
    const alternates = alternatesFor(base, page.path);
    for (const loc of opts.locUrlLocales) {
      entries.push({
        url: `${base}${localizedPath(loc, page.path)}`,
        lastModified: page.lastModified,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates,
      });
    }
  }
  if (opts.includeLegal) entries.push(...(await collectLegalEntries(base)));
  return entries;
}

const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => XML_ESCAPE[c]!);
}

function toIso(lastModified: Date | string | undefined): string | null {
  if (!lastModified) return null;
  const d = typeof lastModified === 'string' ? new Date(lastModified) : lastModified;
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Sérialise des entrées `MetadataRoute.Sitemap` en XML sitemap 0.9 + namespace
 * `xhtml` (pour les `<xhtml:link rel="alternate" hreflang>`). Utilisé par le
 * route handler par-locale (`app/[locale]/sitemap.xml`), `app/sitemap.ts`
 * laissant Next sérialiser nativement.
 */
export function serializeSitemap(entries: MetadataRoute.Sitemap): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const entry of entries) {
    lines.push('<url>');
    lines.push(`<loc>${xmlEscape(entry.url)}</loc>`);
    const iso = toIso(entry.lastModified);
    if (iso) lines.push(`<lastmod>${iso}</lastmod>`);
    if (entry.changeFrequency) lines.push(`<changefreq>${entry.changeFrequency}</changefreq>`);
    if (typeof entry.priority === 'number') lines.push(`<priority>${entry.priority}</priority>`);
    const languages = entry.alternates?.languages;
    if (languages) {
      for (const [hreflang, href] of Object.entries(languages)) {
        if (typeof href === 'string') {
          lines.push(
            `<xhtml:link rel="alternate" hreflang="${xmlEscape(hreflang)}" href="${xmlEscape(href)}"/>`,
          );
        }
      }
    }
    lines.push('</url>');
  }
  lines.push('</urlset>');
  return lines.join('\n');
}
