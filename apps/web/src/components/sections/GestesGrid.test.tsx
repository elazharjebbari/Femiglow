import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GestesGrid } from './GestesGrid';
import { mockHomepage } from '@/data/mock/homepage';
import { KIT_GESTURE_COUNT } from '@/lib/products/kit-facts';
import { expectNoAxeViolations } from '@/test/axe';

describe('GestesGrid', () => {
  it('rend les 4 gestes du rituel (Préparer · Paste · Powder · Polir)', () => {
    render(<GestesGrid etapes={mockHomepage.gestes} />);
    const items = screen.getAllByRole('heading', { level: 3 });
    expect(items).toHaveLength(KIT_GESTURE_COUNT);
  });

  it('numérote les gestes avec padding 01..04', () => {
    render(<GestesGrid etapes={mockHomepage.gestes} />);
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('04')).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<GestesGrid etapes={mockHomepage.gestes} />);
    await expectNoAxeViolations(container);
  });
});
