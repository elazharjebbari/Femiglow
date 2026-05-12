import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroMaison } from './HeroMaison';
import { mockMaison } from '@/data/mock/maison';
import { expectNoAxeViolations } from '@/test/axe';

describe('HeroMaison', () => {
  it('rend le h1 « La maison d’éclat. » et le CTA scroll', () => {
    render(<HeroMaison data={mockMaison.hero} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/maison d.éclat/i);
    const cta = screen.getByRole('link', { name: /découvrir l.atelier/i });
    expect(cta).toHaveAttribute('href', '#origine');
  });

  it('affiche le kicker et le sous-titre', () => {
    render(<HeroMaison data={mockMaison.hero} />);
    expect(screen.getByText(/^La maison$/)).toBeInTheDocument();
    expect(screen.getByText(/Rabat/i)).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<HeroMaison data={mockMaison.hero} />);
    await expectNoAxeViolations(container);
  });
});
