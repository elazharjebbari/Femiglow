import {
  mockArticles,
  mockKit,
  mockKitPageContent,
  mockHomepage,
  mockMaison,
  mockRituel,
} from '@/data/mock';
// Phase 3 T3.5/T3.6 — Mocks localisés ingérés ici. Les 4 pages CMS
// (homepage, maison, rituel, kit) servent maintenant un contenu AR / EN
// dédié sans fallback FR (cf. dictionnaires `*ByLocale` ci-dessous).
import { mockHomepageAr } from '@/data/mock/homepage.ar';
import { mockHomepageEn } from '@/data/mock/homepage.en';
import { mockMaisonAr } from '@/data/mock/maison.ar';
import { mockMaisonEn } from '@/data/mock/maison.en';
import { mockRituelAr } from '@/data/mock/rituel.ar';
import { mockRituelEn } from '@/data/mock/rituel.en';
import { mockKitPageContentAr } from '@/data/mock/kit.ar';
import { mockKitPageContentEn } from '@/data/mock/kit.en';
import type { CMSAdapter, GetArticlesOptions, GetArticlesPageOptions } from '../types';
import type { CmsLocaleOptions } from '../locale-options';
import { pickByLocale } from '../pick-by-locale';

/**
 * Dictionnaires de contenu indexés par locale, consommés par
 * `pickByLocale`. Phase 3.6 — Toutes les pages CMS (homepage, maison,
 * rituel, kit) ont des bindings AR + EN dédiés, alignés sur les fichiers
 * `messages/*.json` et le tone guide `docs/i18n-content-2026-05/
 * 00-style-reference.md`.
 */
const homepageByLocale = {
  fr: mockHomepage,
  ar: mockHomepageAr,
  en: mockHomepageEn,
};
const maisonByLocale = {
  fr: mockMaison,
  ar: mockMaisonAr,
  en: mockMaisonEn,
};
const rituelByLocale = {
  fr: mockRituel,
  ar: mockRituelAr,
  en: mockRituelEn,
};
const kitPageByLocale = {
  fr: mockKitPageContent,
  ar: mockKitPageContentAr,
  en: mockKitPageContentEn,
};

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
