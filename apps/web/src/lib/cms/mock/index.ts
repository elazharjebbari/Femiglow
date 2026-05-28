import {
  mockArticles,
  mockKit,
  mockKitPageContent,
  mockHomepage,
  mockMaison,
  mockRituel,
} from '@/data/mock';
// Phase 3 T3.5 — Premiers vrais mocks localisés (homepage).
// Les autres pages (maison/rituel/kit) feront fallback FR jusqu'à
// création de leurs équivalents *.ar.ts / *.en.ts respectifs.
import { mockHomepageAr } from '@/data/mock/homepage.ar';
import { mockHomepageEn } from '@/data/mock/homepage.en';
import type { CMSAdapter, GetArticlesOptions, GetArticlesPageOptions } from '../types';
import type { CmsLocaleOptions } from '../locale-options';
import { pickByLocale } from '../pick-by-locale';

/**
 * Dictionnaires de contenu indexés par locale, consommés par
 * `pickByLocale`. Phase 3.5 ingérera de vrais bindings AR/EN ici
 * (depuis `docs/i18n-content-2026-05/03-seed-data/`).
 *
 * Pour l'instant, seul `fr` est défini → toutes les locales fallback
 * sur le contenu FR de `mockHomepage` etc. Aucune régression côté UI.
 */
const homepageByLocale = {
  fr: mockHomepage,
  ar: mockHomepageAr,
  en: mockHomepageEn,
};
const maisonByLocale = { fr: mockMaison };
const rituelByLocale = { fr: mockRituel };
const kitPageByLocale = { fr: mockKitPageContent };

export const mockAdapter: CMSAdapter = {
  async getArticles(options: GetArticlesOptions = {}) {
    let articles = [...mockArticles];
    if (options.category) {
      articles = articles.filter((a) => a.category === options.category);
    }
    if (options.featured) {
      articles = articles.filter((a) => a.isFeatured);
    }
    articles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    if (options.limit !== undefined) {
      articles = articles.slice(0, options.limit);
    }
    return articles;
  },

  async getArticlesPage(options: GetArticlesPageOptions = {}) {
    const limit = options.limit ?? 12;
    let articles = [...mockArticles];
    if (options.category) {
      articles = articles.filter((a) => a.category === options.category);
    }
    articles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    if (options.cursor) {
      const cursorIndex = articles.findIndex((a) => a.slug === options.cursor);
      if (cursorIndex >= 0) {
        articles = articles.slice(cursorIndex + 1);
      }
    }
    const items = articles.slice(0, limit);
    const hasMore = articles.length > limit;
    const lastSlug = items[items.length - 1]?.slug ?? null;
    return { items, nextCursor: hasMore ? lastSlug : null };
  },

  async getArticleBySlug(slug: string) {
    return mockArticles.find((a) => a.slug === slug) ?? null;
  },

  async getRelatedArticles(slug: string, limit = 3) {
    const current = mockArticles.find((a) => a.slug === slug);
    if (!current) return [];
    const sameCategory = mockArticles
      .filter((a) => a.slug !== slug && a.category === current.category)
      .slice(0, limit);
    if (sameCategory.length >= limit) return sameCategory;
    const others = mockArticles
      .filter((a) => a.slug !== slug && !sameCategory.includes(a))
      .slice(0, limit - sameCategory.length);
    return [...sameCategory, ...others];
  },

  async getKit() {
    return mockKit;
  },

  async getHomepageContent(options?: CmsLocaleOptions) {
    return pickByLocale(homepageByLocale, options);
  },

  async getMaisonPageContent(options?: CmsLocaleOptions) {
    return pickByLocale(maisonByLocale, options);
  },

  async getRituelPageContent(options?: CmsLocaleOptions) {
    return pickByLocale(rituelByLocale, options);
  },

  async getKitPageContent(options?: CmsLocaleOptions) {
    return pickByLocale(kitPageByLocale, options);
  },
};
