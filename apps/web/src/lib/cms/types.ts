import type {
  Article,
  ArticleCategory,
  HomepageContent,
  KitPageContent,
  MaisonPageContent,
  Product,
  RituelPageContent,
} from '@/lib/schemas';

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

  getHomepageContent(): Promise<HomepageContent>;
  getMaisonPageContent(): Promise<MaisonPageContent>;
  getRituelPageContent(): Promise<RituelPageContent>;
  getKitPageContent(): Promise<KitPageContent>;
}
