import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AvisStrip } from './AvisStrip';
import { mockHomepage } from '@/data/mock/homepage';
import { expectNoAxeViolations } from '@/test/axe';

describe('AvisStrip', () => {
  it('rend une figure par témoignage', () => {
    render(<AvisStrip testimonials={mockHomepage.avis} />);
    expect(screen.getAllByRole('figure')).toHaveLength(mockHomepage.avis.length);
  });

  it('respecte axe', async () => {
    const { container } = render(<AvisStrip testimonials={mockHomepage.avis} />);
    await expectNoAxeViolations(container);
  });

  it('renvoie null si la liste est vide', () => {
    const { container } = render(<AvisStrip testimonials={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
