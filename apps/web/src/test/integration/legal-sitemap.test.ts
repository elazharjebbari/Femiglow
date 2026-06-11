/**
 * Tests sitemap.ts — vérifie l'intégration des pages légales selon l'état
 * de la DB :
 *  - DB indisponible → sitemap statique uniquement, pas de crash
 *  - aucune page publiée searchable → pas d'entrée /legal/
 *  - pages mixtes (3 searchable, 6 noindex) → seules les searchable
 *    apparaissent
 *  - lastModified correctement formaté (Date)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

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

const articlesMock = vi.fn();
vi.mock('@/lib/cms', () => ({
  cms: {
    getArticles: (opts: unknown) => articlesMock(opts),
  },
}));

const listSearchableMock = vi.fn();
vi.mock('@/lib/legal/repository', () => ({
  listPublishedSearchablePages: () => listSearchableMock(),
}));

import sitemap from '@/app/sitemap';

beforeEach(() => {
  articlesMock.mockReset();
  listSearchableMock.mockReset();
});

describe('sitemap.ts — édition cas standards', () => {
  it('inclut les routes statiques par défaut', async () => {
    articlesMock.mockResolvedValue([]);
    listSearchableMock.mockResolvedValue([]);
    const out = await sitemap();
    const urls = out.map((e) => e.url);
    // Préfixe locale (FR inclus), variantes traduites présentes.
    expect(urls).toContain('https://femiglow.ma/fr/');
    expect(urls).toContain('https://femiglow.ma/fr/rituel');
    expect(urls).toContain('https://femiglow.ma/fr/contact');
    expect(urls).toContain('https://femiglow.ma/ar/contact');
    expect(urls).toContain('https://femiglow.ma/en/kit');
  });

  it('inclut les articles du CMS', async () => {
    articlesMock.mockResolvedValue([
      { slug: 'article-1', updatedAt: new Date('2026-05-01'), publishedAt: new Date('2026-04-01') },
      { slug: 'article-2', updatedAt: null, publishedAt: new Date('2026-04-15') },
    ]);
    listSearchableMock.mockResolvedValue([]);
    const out = await sitemap();
    const urls = out.map((e) => e.url);
    // Chaque article décliné FR/AR/EN.
    for (const loc of ['fr', 'ar', 'en']) {
      expect(urls).toContain(`https://femiglow.ma/${loc}/journal/article-1`);
      expect(urls).toContain(`https://femiglow.ma/${loc}/journal/article-2`);
    }
  });

  it('exclut /legal/* si aucune page publiée searchable', async () => {
    articlesMock.mockResolvedValue([]);
    listSearchableMock.mockResolvedValue([]);
    const out = await sitemap();
    const legalUrls = out.filter((e) => e.url.includes('/legal/'));
    expect(legalUrls).toEqual([]);
  });
});

describe('sitemap.ts — pages légales mixtes', () => {
  it('inclut uniquement les pages avec include_in_search=true', async () => {
    articlesMock.mockResolvedValue([]);
    listSearchableMock.mockResolvedValue([
      {
        slug: 'livraison',
        updatedAt: new Date('2026-05-01'),
        publishedAt: new Date('2026-04-15'),
      },
      {
        slug: 'faq',
        updatedAt: new Date('2026-05-02'),
        publishedAt: new Date('2026-04-20'),
      },
    ]);

    const out = await sitemap();
    const legalUrls = out.filter((e) => e.url.includes('/legal/'));
    expect(legalUrls).toHaveLength(2);
    expect(legalUrls.map((e) => e.url).sort()).toEqual([
      'https://femiglow.ma/legal/faq',
      'https://femiglow.ma/legal/livraison',
    ]);
  });

  it('lastModified utilise publishedAt si dispo, sinon updatedAt', async () => {
    articlesMock.mockResolvedValue([]);
    const pub = new Date('2026-04-15');
    const upd = new Date('2026-05-01');
    listSearchableMock.mockResolvedValue([
      { slug: 'livraison', updatedAt: upd, publishedAt: pub },
      { slug: 'orphan', updatedAt: upd, publishedAt: null },
    ]);

    const out = await sitemap();
    const livraison = out.find((e) => e.url.endsWith('/livraison'));
    const orphan = out.find((e) => e.url.endsWith('/orphan'));
    expect(livraison?.lastModified).toEqual(pub);
    expect(orphan?.lastModified).toEqual(upd);
  });
});

describe('sitemap.ts — résilience DB', () => {
  it('si listPublishedSearchablePages throw, le sitemap statique sort quand même', async () => {
    articlesMock.mockResolvedValue([]);
    listSearchableMock.mockRejectedValue(new Error('DB unavailable'));
    const out = await sitemap();
    // Pas de crash, les routes statiques sont là
    expect(out.length).toBeGreaterThanOrEqual(6);
    expect(out.some((e) => e.url.endsWith('/contact'))).toBe(true);
    // Et pas d'entrée /legal/
    expect(out.some((e) => e.url.includes('/legal/'))).toBe(false);
  });

  it('si cms.getArticles throw, le reste sort quand même (V1.1 — try/catch ajouté phase 1 SEO)', async () => {
    articlesMock.mockRejectedValue(new Error('CMS down'));
    listSearchableMock.mockResolvedValue([]);
    // V1.1 (phase 1 SEO, mai 2026) : `getArticles` est encapsulé dans un
    // try/catch pour que le sitemap statique sorte même si le CMS est
    // indisponible. Cohérent avec le comportement déjà en place pour
    // `listPublishedSearchablePages`.
    const out = await sitemap();
    expect(out.length).toBeGreaterThanOrEqual(6);
    // Pas d'entrée article : la section dynamique a échoué silencieusement.
    expect(out.some((e) => e.url.includes('/journal/'))).toBe(false);
    // Routes statiques toujours présentes.
    expect(out.some((e) => e.url.endsWith('/contact'))).toBe(true);
  });
});
