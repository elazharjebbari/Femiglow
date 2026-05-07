import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorialLetter } from './EditorialLetter';
import { expectNoAxeViolations } from '@/test/axe';

describe('EditorialLetter', () => {
  it('rend la signature « Salma »', () => {
    render(<EditorialLetter firstName="Salma" />);
    expect(screen.getByText('Salma')).toBeInTheDocument();
    expect(screen.getByText(/fondatrice/i)).toBeInTheDocument();
  });

  it('rend le mot d’ouverture personnalisé', () => {
    render(<EditorialLetter firstName="Anne" />);
    expect(
      screen.getByText(/Anne, merci d['’]avoir confié/),
    ).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<EditorialLetter firstName="Salma" />);
    await expectNoAxeViolations(container);
  });
});
