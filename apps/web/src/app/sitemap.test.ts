/**
 * Tests `app/sitemap.ts`.
 *
 * Couvre les invariants SEO :
 *  - Les 6 routes statiques attendues sont présentes et toutes liées à
 *    `NEXT_PUBLIC_BUILD_DATE` (constant entre déploiements identiques).
 *  - Les articles sont mappés sur `updatedAt` (fallback `publishedAt`).
 *  - Les pages légales searchable sont incluses, avec `updatedAt` réel.
 *  - Si la DB est indisponible (mock throw), seules les routes statiques
 *    sont renvoyées — pas de 500.
 *  - Si `NEXT_PUBLIC_BUILD_DATE` est absent, fallback à `new Date(0)`
 *    (sentinel inoffensive, mieux que NaN).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cms', () => ({
  cms: { getArticles: vi.fn() },
}));
vi.mock('@/lib/legal/repository', () => ({
  listPublishedSearchablePages: vi.fn(),
}));
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

import { cms } from '@/lib/cms';
import { listPublishedSearchablePages } from '@/lib/legal/repository';
import sitemap from './sitemap';

const ORIGINAL_BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_BUILD_DATE = '2026-05-19T00:00:00.000Z';
  vi.mocked(cms.getArticles).mockResolvedValue([]);
  vi.mocked(listPublishedSearchablePages).mockResolvedValue([]);
});

afterEach(() => {
  process.env.NEXT_PUBLIC_BUILD_DATE = ORIGINAL_BUILD_DATE;
});

describe('sitemap', () => {
  it('liste les 6 routes statiques en FR/AR/EN (préfixe locale) + lastModified = BUILD_DATE', async () => {
    const result = await sitemap();
    const urls = result.map((e) => e.url);
    // FR (préfixe /fr/, comme les hreflang des pages).
    const expectedFr = [
      'https://femiglow.ma/fr/',
      'https://femiglow.ma/fr/rituel',
      'https://femiglow.ma/fr/kit',
      'https://femiglow.ma/fr/journal',
      'https://femiglow.ma/fr/maison',
      'https://femiglow.ma/fr/contact',
    ];
    expectedFr.forEach((url) => expect(urls).toContain(url));
    // Variantes traduites présentes comme entrées à part entière.
    ['ar', 'en'].forEach((loc) => {
      expect(urls).toContain(`https://femiglow.ma/${loc}/kit`);
      expect(urls).toContain(`https://femiglow.ma/${loc}/`);
    });
    // Tous les statiques partagent la même date de build.
    expectedFr.forEach((url) => {
      const entry = result.find((e) => e.url === url);
      expect(entry?.lastModified).toEqual(new Date('2026-05-19T00:00:00.000Z'));
    });
  });

  it('porte les alternates hreflang fr/ar/en + x-default sur chaque entrée', async () => {
    const result = await sitemap();
    const kitFr = result.find((e) => e.url === 'https://femiglow.ma/fr/kit');
    expect(kitFr?.alternates?.languages).toEqual({
      fr: 'https://femiglow.ma/fr/kit',
      ar: 'https://femiglow.ma/ar/kit',
      en: 'https://femiglow.ma/en/kit',
      'x-default': 'https://femiglow.ma/fr/kit',
    });
  });

  it('mappe les articles (FR/AR/EN) sur updatedAt (priorité fraîcheur)', async () => {
    vi.mocked(cms.getArticles).mockResolvedValue([
      {
        slug: 'rituel-eclat',
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-04-15T10:00:00Z'),
      },
    ] as never);
    const result = await sitemap();
    for (const loc of ['fr', 'ar', 'en']) {
      const article = result.find(
        (e) => e.url === `https://femiglow.ma/${loc}/journal/rituel-eclat`,
      );
      expect(article).toBeTruthy();
      expect(article?.lastModified).toEqual(new Date('2026-04-15T10:00:00Z'));
    }
  });

  it('retombe sur publishedAt si updatedAt absent', async () => {
    vi.mocked(cms.getArticles).mockResolvedValue([
      {
        slug: 'foo',
        publishedAt: new Date('2026-03-01T00:00:00Z'),
        updatedAt: null,
      },
    ] as never);
    const result = await sitemap();
    const article = result.find((e) => e.url === 'https://femiglow.ma/fr/journal/foo');
    expect(article?.lastModified).toEqual(new Date('2026-03-01T00:00:00Z'));
  });

  it('inclut les pages legal searchable, lastModified = publishedAt (priorité stabilité)', async () => {
    vi.mocked(listPublishedSearchablePages).mockResolvedValue([
      {
        slug: 'cgv',
        publishedAt: new Date('2026-02-01T00:00:00Z'),
        updatedAt: new Date('2026-05-01T00:00:00Z'),
      },
    ] as never);
    const result = await sitemap();
    const legal = result.find((e) => e.url === 'https://femiglow.ma/legal/cgv');
    expect(legal).toBeTruthy();
    // Comportement existant verrouillé par legal-sitemap.test.ts :
    // les pages légales utilisent `publishedAt` pour éviter le re-crawl
    // sur les ajustements éditoriaux mineurs.
    expect(legal?.lastModified).toEqual(new Date('2026-02-01T00:00:00Z'));
  });

  it('legal page sans publishedAt → fallback updatedAt', async () => {
    vi.mocked(listPublishedSearchablePages).mockResolvedValue([
      { slug: 'draft-policy', publishedAt: null, updatedAt: new Date('2026-04-01T00:00:00Z') },
    ] as never);
    const result = await sitemap();
    const legal = result.find((e) => e.url === 'https://femiglow.ma/legal/draft-policy');
    expect(legal?.lastModified).toEqual(new Date('2026-04-01T00:00:00Z'));
  });

  it('si la DB articles throw, retombe sur les statiques uniquement (pas de 500)', async () => {
    vi.mocked(cms.getArticles).mockRejectedValue(new Error('DB down'));
    const result = await sitemap();
    // 6 statiques toujours présentes.
    expect(result.length).toBeGreaterThanOrEqual(6);
    expect(result.find((e) => e.url.includes('/journal/'))).toBeUndefined();
  });

  it('si la DB legal throw, retombe sur statiques + articles (pas de 500)', async () => {
    vi.mocked(listPublishedSearchablePages).mockRejectedValue(new Error('DB down'));
    vi.mocked(cms.getArticles).mockResolvedValue([
      {
        slug: 'foo',
        publishedAt: new Date('2026-03-01T00:00:00Z'),
        updatedAt: new Date('2026-04-01T00:00:00Z'),
      },
    ] as never);
    const result = await sitemap();
    expect(result.find((e) => e.url === 'https://femiglow.ma/fr/journal/foo')).toBeTruthy();
    expect(result.find((e) => e.url.includes('/legal/'))).toBeUndefined();
  });

  it('absence de NEXT_PUBLIC_BUILD_DATE → fallback à epoch (pas NaN)', async () => {
    delete process.env.NEXT_PUBLIC_BUILD_DATE;
    const result = await sitemap();
    const home = result.find((e) => e.url === 'https://femiglow.ma/fr/');
    expect(home?.lastModified).toEqual(new Date(0));
  });

  it('valeur invalide de NEXT_PUBLIC_BUILD_DATE → fallback à epoch', async () => {
    process.env.NEXT_PUBLIC_BUILD_DATE = 'not-a-date';
    const result = await sitemap();
    const home = result.find((e) => e.url === 'https://femiglow.ma/fr/');
    expect(home?.lastModified).toEqual(new Date(0));
  });
});
