import {
  mockArticles,
  mockKit,
  mockKitPageContent,
  mockHomepage,
  mockMaison,
  mockRituel,
} from '@/data/mock';
import type { CMSAdapter, GetArticlesOptions, GetArticlesPageOptions } from '../types';

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

  async getHomepageContent() {
    return mockHomepage;
  },

  async getMaisonPageContent() {
    return mockMaison;
  },

  async getRituelPageContent() {
    return mockRituel;
  },

  async getKitPageContent() {
    return mockKitPageContent;
  },
};
