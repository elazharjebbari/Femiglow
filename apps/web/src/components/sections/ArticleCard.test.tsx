import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArticleCard } from './ArticleCard';
import { mockArticles } from '@/data/mock/articles';
import { expectNoAxeViolations } from '@/test/axe';

describe('ArticleCard', () => {
  const article = mockArticles[0]!;

  it('affiche titre, excerpt, kicker catégorie et durée de lecture', () => {
    render(<ArticleCard article={article} />);
    expect(screen.getByRole('heading', { name: article.title })).toBeInTheDocument();
    expect(screen.getByText(article.excerpt)).toBeInTheDocument();
    expect(screen.getByText('Saison')).toBeInTheDocument();
    expect(screen.getByText(/min de lecture/)).toBeInTheDocument();
  });

  it('lie le titre vers /journal/<slug> et expose un aria-label complet', () => {
    render(<ArticleCard article={article} />);
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', `/journal/${article.slug}`);
    expect(links[0]).toHaveAttribute(
      'aria-label',
      expect.stringContaining(article.title),
    );
  });

  it('utilise le niveau de heading demandé', () => {
    render(<ArticleCard article={article} headingLevel="h2" />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<ArticleCard article={article} headingLevel="h2" />);
    await expectNoAxeViolations(container);
  });
});
