import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JournalGrid } from './JournalGrid';
import { mockArticles } from '@/data/mock/articles';
import { expectNoAxeViolations } from '@/test/axe';

describe('JournalGrid', () => {
  it('rend null si aucun article', () => {
    const { container } = render(<JournalGrid articles={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('limite le nombre d\u2019articles affichés via la prop limit', () => {
    render(<JournalGrid articles={mockArticles} limit={3} />);
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('respecte axe en variant symmetric', async () => {
    const { container } = render(
      <JournalGrid articles={mockArticles.slice(0, 3)} variant="symmetric" />,
    );
    await expectNoAxeViolations(container);
  });

  it('respecte axe en variant asymmetric', async () => {
    const { container } = render(
      <JournalGrid articles={mockArticles.slice(0, 3)} variant="asymmetric" />,
    );
    await expectNoAxeViolations(container);
  });
});
