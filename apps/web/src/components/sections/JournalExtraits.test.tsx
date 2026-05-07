import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JournalExtraits } from './JournalExtraits';
import { mockArticles } from '@/data/mock/articles';
import { expectNoAxeViolations } from '@/test/axe';

describe('JournalExtraits', () => {
  it('rend un titre h2 et trois articles', () => {
    render(<JournalExtraits articles={mockArticles} />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('renvoie null si aucun article', () => {
    const { container } = render(<JournalExtraits articles={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('respecte axe', async () => {
    const { container } = render(<JournalExtraits articles={mockArticles} />);
    await expectNoAxeViolations(container);
  });
});
