import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryPills } from './CategoryPills';
import { expectNoAxeViolations } from '@/test/axe';

describe('CategoryPills', () => {
  it('rend les six pills attendues', () => {
    render(<CategoryPills active="all" />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(6);
    expect(links.map((l) => l.textContent)).toEqual([
      'Toutes',
      'Maison',
      'Saison',
      'Voix',
      'Matières',
      'Pratique',
    ]);
  });

  it('marque la pill active avec aria-current="page"', () => {
    render(<CategoryPills active="saison" />);
    const active = screen.getByRole('link', { current: 'page' });
    expect(active).toHaveTextContent('Saison');
  });

  it('génère le bon href par catégorie', () => {
    render(<CategoryPills active="all" />);
    expect(screen.getByRole('link', { name: 'Toutes' })).toHaveAttribute('href', '/journal');
    expect(screen.getByRole('link', { name: 'Saison' })).toHaveAttribute(
      'href',
      '/journal?category=saison',
    );
    expect(screen.getByRole('link', { name: 'Matières' })).toHaveAttribute(
      'href',
      '/journal?category=matieres',
    );
  });

  it('respecte axe', async () => {
    const { container } = render(<CategoryPills active="voix" />);
    await expectNoAxeViolations(container);
  });
});
