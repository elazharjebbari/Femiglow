import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorialLetter } from './EditorialLetter';
import { expectNoAxeViolations } from '@/test/axe';

describe('EditorialLetter', () => {
  it('rend la signature de la fondatrice (anonymisée — politique no-founder)', () => {
    render(<EditorialLetter firstName="Salma" />);
    expect(screen.getByText('notre fondatrice')).toBeInTheDocument();
    expect(screen.getByText('Fondatrice · FemiGlow')).toBeInTheDocument();
  });

  it('rend le mot d’ouverture personnalisé', () => {
    render(<EditorialLetter firstName="Anne" />);
    expect(
      screen.getByText(/Anne, merci d['’]avoir confié/),
    ).toBeInTheDocument();
  });

  it('scope la police Pinyon localement (variable sur la section, pas via le root layout)', () => {
    // Garde-fou priorité 2 (dégraissage polices) : Pinyon est initialisée dans
    // ce composant pour que next/font ne la précharge que sur les routes qui le
    // rendent. La variable doit être posée sur la <section> et la signature doit
    // la consommer via var(--font-pinyon).
    const { container } = render(<EditorialLetter firstName="Salma" />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('--font-pinyon');
    const signature = screen.getByText('notre fondatrice');
    expect(signature.getAttribute('style')).toContain('var(--font-pinyon)');
  });

  it('respecte axe', async () => {
    const { container } = render(<EditorialLetter firstName="Salma" />);
    await expectNoAxeViolations(container);
  });
});
