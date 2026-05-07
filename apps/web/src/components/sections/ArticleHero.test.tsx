import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArticleHero } from './ArticleHero';
import { mockArticles } from '@/data/mock/articles';
import { expectNoAxeViolations } from '@/test/axe';

const article = mockArticles[0]!;

describe('ArticleHero', () => {
  it('rend le h1 avec le titre de l\u2019article et l\u2019italique partiel', () => {
    render(<ArticleHero article={article} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(article.title);
  });

  it('expose le kicker catégorie et le nom de l\u2019auteur', () => {
    render(<ArticleHero article={article} />);
    expect(screen.getByText(article.author.name)).toBeInTheDocument();
    expect(screen.getByText(/min de lecture/i)).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<ArticleHero article={article} />);
    await expectNoAxeViolations(container);
  });
});
