import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EngagementsGrid } from './EngagementsGrid';
import { mockMaison } from '@/data/mock/maison';
import { expectNoAxeViolations } from '@/test/axe';

describe('EngagementsGrid', () => {
  it('rend 4 engagements ordonnés 01..04', () => {
    render(<EngagementsGrid engagements={mockMaison.engagements} />);
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(4);
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
  });

  it('respecte l’ordre numérique même si les données arrivent dans le désordre', () => {
    const shuffled = [...mockMaison.engagements].reverse();
    render(<EngagementsGrid engagements={shuffled} />);
    const numbers = [...document.querySelectorAll('article > span')]
      .filter((s) => /^0[1-4]$/.test(s.textContent ?? ''))
      .map((s) => s.textContent);
    expect(numbers).toEqual(['01', '02', '03', '04']);
  });

  it('respecte axe', async () => {
    const { container } = render(
      <EngagementsGrid engagements={mockMaison.engagements} />,
    );
    await expectNoAxeViolations(container);
  });
});
