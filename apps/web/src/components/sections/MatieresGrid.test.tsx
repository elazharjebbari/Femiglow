import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatieresGrid } from './MatieresGrid';
import { mockMaison } from '@/data/mock/maison';
import { expectNoAxeViolations } from '@/test/axe';

describe('MatieresGrid', () => {
  it('rend les 4 matières en h3 avec leurs noms', () => {
    render(<MatieresGrid matieres={mockMaison.matieres} />);
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings).toHaveLength(4);
    expect(headings.map((h) => h.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/cire/i),
        expect.stringMatching(/jojoba/i),
        expect.stringMatching(/kaolin/i),
        expect.stringMatching(/mica/i),
      ]),
    );
  });

  it('expose Origine et Pourquoi pour chaque matière', () => {
    render(<MatieresGrid matieres={mockMaison.matieres} />);
    expect(screen.getAllByText(/^Origine$/i)).toHaveLength(4);
    expect(screen.getAllByText(/^Pourquoi$/i)).toHaveLength(4);
  });

  it('respecte axe', async () => {
    const { container } = render(
      <MatieresGrid matieres={mockMaison.matieres} />,
    );
    await expectNoAxeViolations(container);
  });
});
