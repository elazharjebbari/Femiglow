import type { CMSAdapter } from '../types';

/**
 * Stub Sanity adapter. À implémenter en Phase 2 avec next-sanity + GROQ.
 * Le contrat CMSAdapter doit être respecté à 100 % pour permettre la bascule
 * mock → sanity sans changement dans les pages ou composants.
 */
export const sanityAdapter: CMSAdapter = {
  async getArticles() {
    throw new Error('sanityAdapter.getArticles not implemented yet (Phase 2).');
  },
  async getArticlesPage() {
    throw new Error('sanityAdapter.getArticlesPage not implemented yet (Phase 2).');
  },
  async getArticleBySlug() {
    throw new Error('sanityAdapter.getArticleBySlug not implemented yet (Phase 2).');
  },
  async getRelatedArticles() {
    throw new Error('sanityAdapter.getRelatedArticles not implemented yet (Phase 2).');
  },
  async getKit() {
    throw new Error('sanityAdapter.getKit not implemented yet (Phase 2).');
  },
  async getHomepageContent() {
    throw new Error('sanityAdapter.getHomepageContent not implemented yet (Phase 2).');
  },
  async getMaisonPageContent() {
    throw new Error('sanityAdapter.getMaisonPageContent not implemented yet (Phase 2).');
  },
  async getRituelPageContent() {
    throw new Error('sanityAdapter.getRituelPageContent not implemented yet (Phase 2).');
  },
  async getKitPageContent() {
    throw new Error('sanityAdapter.getKitPageContent not implemented yet (Phase 2).');
  },
};
