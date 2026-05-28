import type {
  Article,
  ArticleCategory,
  HomepageContent,
  KitPageContent,
  MaisonPageContent,
  Product,
  RituelPageContent,
} from '@/lib/schemas';

import type { CmsLocaleOptions } from './locale-options';

export interface GetArticlesOptions {
  limit?: number;
  category?: ArticleCategory;
  featured?: boolean;
}

export interface GetArticlesPageOptions {
  limit?: number;
  cursor?: string;
  category?: ArticleCategory;
}

export interface ArticlesPage {
  items: Article[];
  nextCursor: string | null;
}

export interface CMSAdapter {
  getArticles(options?: GetArticlesOptions): Promise<Article[]>;
  getArticlesPage(options?: GetArticlesPageOptions): Promise<ArticlesPage>;
  getArticleBySlug(slug: string): Promise<Article | null>;
  getRelatedArticles(slug: string, limit?: number): Promise<Article[]>;

  getKit(): Promise<Product>;

  getHomepageContent(options?: CmsLocaleOptions): Promise<HomepageContent>;
  getMaisonPageContent(options?: CmsLocaleOptions): Promise<MaisonPageContent>;
  getRituelPageContent(options?: CmsLocaleOptions): Promise<RituelPageContent>;
  getKitPageContent(options?: CmsLocaleOptions): Promise<KitPageContent>;
}
