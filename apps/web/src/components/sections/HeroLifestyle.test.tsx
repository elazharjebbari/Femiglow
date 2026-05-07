import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroLifestyle } from './HeroLifestyle';
import { mockRituel } from '@/data/mock/rituel';
import { expectNoAxeViolations } from '@/test/axe';

describe('HeroLifestyle', () => {
  it('rend le titre en h1', () => {
    render(<HeroLifestyle data={mockRituel.hero} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('rend le kicker et le sous-titre', () => {
    render(<HeroLifestyle data={mockRituel.hero} />);
    expect(screen.getByText(mockRituel.hero.kicker!)).toBeInTheDocument();
    expect(screen.getByText(mockRituel.hero.subtitle!)).toBeInTheDocument();
  });

  it('expose une image avec alt descriptif', () => {
    render(<HeroLifestyle data={mockRituel.hero} />);
    expect(screen.getByAltText(mockRituel.hero.image!.alt)).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<HeroLifestyle data={mockRituel.hero} />);
    await expectNoAxeViolations(container);
  });
});
