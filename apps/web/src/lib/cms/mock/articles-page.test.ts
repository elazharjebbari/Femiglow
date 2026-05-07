import { describe, it, expect } from 'vitest';
import { mockAdapter } from './index';
import { mockArticles } from '@/data/mock/articles';

describe('mockAdapter.getArticlesPage', () => {
  it('renvoie les 12 premiers articles + un cursor non null si plus de 12', async () => {
    const page = await mockAdapter.getArticlesPage({ limit: 12 });
    expect(page.items).toHaveLength(12);
    expect(page.nextCursor).not.toBeNull();
  });

  it('paginate via cursor sans dupliquer', async () => {
    const page1 = await mockAdapter.getArticlesPage({ limit: 12 });
    expect(page1.nextCursor).not.toBeNull();
    const page2 = await mockAdapter.getArticlesPage({ limit: 12, cursor: page1.nextCursor! });
    const slugs = new Set([...page1.items, ...page2.items].map((a) => a.slug));
    expect(slugs.size).toBe(page1.items.length + page2.items.length);
    expect(page2.nextCursor).toBeNull();
  });

  it('filtre par catégorie', async () => {
    const page = await mockAdapter.getArticlesPage({ limit: 12, category: 'saison' });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((a) => a.category === 'saison')).toBe(true);
    const expected = mockArticles.filter((a) => a.category === 'saison').length;
    expect(page.items).toHaveLength(Math.min(expected, 12));
  });

  it('renvoie un cursor null quand toute la page tient', async () => {
    const page = await mockAdapter.getArticlesPage({ limit: 50 });
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(mockArticles.length);
  });
});
