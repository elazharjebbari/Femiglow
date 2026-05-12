import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GestesGrid } from './GestesGrid';
import { mockHomepage } from '@/data/mock/homepage';
import { expectNoAxeViolations } from '@/test/axe';

describe('GestesGrid', () => {
  it('rend les 3 gestes du rituel (Paste · Powder · Polish & Shine)', () => {
    render(<GestesGrid etapes={mockHomepage.gestes} />);
    const items = screen.getAllByRole('heading', { level: 3 });
    expect(items).toHaveLength(3);
  });

  it('numérote les gestes avec padding 01..03', () => {
    render(<GestesGrid etapes={mockHomepage.gestes} />);
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<GestesGrid etapes={mockHomepage.gestes} />);
    await expectNoAxeViolations(container);
  });
});
