import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from './Hero';
import { mockHomepage } from '@/data/mock/homepage';
import { expectNoAxeViolations } from '@/test/axe';

describe('Hero', () => {
  it('rend le titre en h1', () => {
    render(<Hero data={mockHomepage.hero} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('rend les CTAs principaux et secondaires', () => {
    render(<Hero data={mockHomepage.hero} />);
    if (mockHomepage.hero.cta) {
      expect(screen.getByRole('link', { name: mockHomepage.hero.cta.label })).toBeInTheDocument();
    }
    if (mockHomepage.hero.ctaSecondary) {
      expect(
        screen.getByRole('link', { name: mockHomepage.hero.ctaSecondary.label }),
      ).toBeInTheDocument();
    }
  });

  it('respecte axe', async () => {
    const { container } = render(<Hero data={mockHomepage.hero} />);
    await expectNoAxeViolations(container);
  });
});
