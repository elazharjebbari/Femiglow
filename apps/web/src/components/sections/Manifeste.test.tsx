import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Manifeste } from './Manifeste';
import { mockHomepage } from '@/data/mock/homepage';
import { expectNoAxeViolations } from '@/test/axe';

describe('Manifeste', () => {
  it('rend le titre en h2', () => {
    render(<Manifeste data={mockHomepage.manifeste} />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('rend tous les paragraphes', () => {
    render(<Manifeste data={mockHomepage.manifeste} />);
    mockHomepage.manifeste.paragraphs.forEach((p) => {
      expect(screen.getByText(p)).toBeInTheDocument();
    });
  });

  it('respecte axe', async () => {
    const { container } = render(<Manifeste data={mockHomepage.manifeste} />);
    await expectNoAxeViolations(container);
  });
});
