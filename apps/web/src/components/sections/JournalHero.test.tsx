import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JournalHero } from './JournalHero';
import { expectNoAxeViolations } from '@/test/axe';

describe('JournalHero', () => {
  it('rend le titre h1 « Le carnet de la maison. » en italique', () => {
    render(<JournalHero />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Le carnet de la maison.');
    expect(h1).toHaveClass('italic');
  });

  it('expose une intro lead', () => {
    render(<JournalHero />);
    expect(screen.getByText(/r\u00e9cits saisonniers/i)).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<JournalHero />);
    await expectNoAxeViolations(container);
  });
});
