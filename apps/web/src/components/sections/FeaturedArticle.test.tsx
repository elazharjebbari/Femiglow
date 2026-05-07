import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeaturedArticle } from './FeaturedArticle';
import { mockArticles } from '@/data/mock/articles';
import { expectNoAxeViolations } from '@/test/axe';

describe('FeaturedArticle', () => {
  const featured = mockArticles.find((a) => a.isFeatured) ?? mockArticles[0]!;

  it('affiche le badge « à la une » et la catégorie', () => {
    render(<FeaturedArticle article={featured} />);
    expect(screen.getByText('à la une')).toBeInTheDocument();
    expect(screen.getByText('Voix')).toBeInTheDocument();
  });

  it('marque le titre comme h2 et lie vers l\u2019article', () => {
    render(<FeaturedArticle article={featured} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent(featured.title);
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', `/journal/${featured.slug}`);
  });

  it('expose un CTA « Lire l\u2019article »', () => {
    const { container } = render(<FeaturedArticle article={featured} />);
    const cta = container.querySelector('p > a');
    expect(cta).not.toBeNull();
    expect(cta).toHaveAttribute('href', `/journal/${featured.slug}`);
    expect(cta?.textContent).toContain('Lire l\u2019article');
  });

  it('respecte axe', async () => {
    const { container } = render(<FeaturedArticle article={featured} />);
    await expectNoAxeViolations(container);
  });
});
