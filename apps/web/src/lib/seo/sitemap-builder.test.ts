/**
 * Tests `sitemap-builder` — périmètre par-langue + sérialisation XML.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cms', () => ({ cms: { getArticles: vi.fn() } }));
vi.mock('@/lib/legal/repository', () => ({ listPublishedSearchablePages: vi.fn() }));
vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' } }));
vi.mock('@/lib/routes', () => ({
  routes: {
    home: '/',
    rituel: '/rituel',
    kit: '/kit',
    journal: '/journal',
    maison: '/maison',
    contact: '/contact',
    article: (slug: string) => `/journal/${slug}`,
  },
}));

import { cms } from '@/lib/cms';
import { listPublishedSearchablePages } from '@/lib/legal/repository';
import { buildSitemapEntries, serializeSitemap } from './sitemap-builder';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_BUILD_DATE = '2026-05-19T00:00:00.000Z';
  vi.mocked(cms.getArticles).mockResolvedValue([] as never);
  vi.mocked(listPublishedSearchablePages).mockResolvedValue([] as never);
});

describe('buildSitemapEntries — périmètre par locale', () => {
  it('locUrlLocales=[ar] → uniquement des <loc> /ar/, avec hreflang fr/ar/en', async () => {
    const entries = await buildSitemapEntries({ locUrlLocales: ['ar'], includeLegal: false });
    const urls = entries.map((e) => e.url);
    // Toutes les loc sont en /ar/.
    expect(urls.every((u) => u.startsWith('https://femiglow.ma/ar'))).toBe(true);
    expect(urls).toContain('https://femiglow.ma/ar/kit');
    expect(urls).not.toContain('https://femiglow.ma/fr/kit');
    // Mais les alternates référencent toutes les langues + x-default.
    const kit = entries.find((e) => e.url === 'https://femiglow.ma/ar/kit');
    expect(kit?.alternates?.languages).toMatchObject({
      fr: 'https://femiglow.ma/fr/kit',
      ar: 'https://femiglow.ma/ar/kit',
      en: 'https://femiglow.ma/en/kit',
      'x-default': 'https://femiglow.ma/fr/kit',
    });
  });

  it('légal exclu hors FR, inclus en FR', async () => {
    vi.mocked(listPublishedSearchablePages).mockResolvedValue([
      { slug: 'faq', publishedAt: new Date('2026-02-01'), updatedAt: new Date('2026-05-01') },
    ] as never);
    const ar = await buildSitemapEntries({ locUrlLocales: ['ar'], includeLegal: false });
    expect(ar.some((e) => e.url.includes('/legal/'))).toBe(false);
    const fr = await buildSitemapEntries({ locUrlLocales: ['fr'], includeLegal: true });
    expect(fr.some((e) => e.url === 'https://femiglow.ma/legal/faq')).toBe(true);
  });
});

describe('serializeSitemap', () => {
  it('produit un XML valide avec <loc> et <xhtml:link hreflang>', async () => {
    const entries = await buildSitemapEntries({ locUrlLocales: ['ar'], includeLegal: false });
    const xml = serializeSitemap(entries);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain('<loc>https://femiglow.ma/ar/kit</loc>');
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="fr" href="https://femiglow.ma/fr/kit"/>',
    );
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://femiglow.ma/fr/kit"/>',
    );
  });

  it('échappe les caractères XML dans les URLs', () => {
    const xml = serializeSitemap([
      { url: 'https://femiglow.ma/ar/journal/a&b', changeFrequency: 'monthly', priority: 0.6 },
    ]);
    expect(xml).toContain('<loc>https://femiglow.ma/ar/journal/a&amp;b</loc>');
  });
});
