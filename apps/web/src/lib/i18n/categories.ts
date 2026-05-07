import type { ArticleCategory } from '@/lib/schemas';

export type CategoryKey = ArticleCategory | 'all';

export const categoryOrder: CategoryKey[] = [
  'all',
  'maison',
  'saison',
  'voix',
  'matieres',
  'pratique',
];

export const categoryLabels: Record<CategoryKey, string> = {
  all: 'Toutes',
  maison: 'Maison',
  saison: 'Saison',
  voix: 'Voix',
  matieres: 'Matières',
  pratique: 'Pratique',
};

export function parseCategory(value: string | undefined): ArticleCategory | null {
  if (!value) return null;
  const valid: ArticleCategory[] = ['maison', 'saison', 'voix', 'matieres', 'pratique'];
  return valid.includes(value as ArticleCategory) ? (value as ArticleCategory) : null;
}
