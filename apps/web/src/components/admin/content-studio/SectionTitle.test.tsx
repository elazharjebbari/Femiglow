import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionTitle } from './SectionTitle';

describe('SectionTitle', () => {
  it('affiche l\'eyebrow, le titre et la description', () => {
    render(
      <SectionTitle
        eyebrow="Production"
        title="Brouillons"
        tone="sky"
        description="Comparer les variantes générées."
      />,
    );
    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('Brouillons')).toBeInTheDocument();
    expect(screen.getByText('Comparer les variantes générées.')).toBeInTheDocument();
  });

  it('affiche le titre sans description quand non fournie', () => {
    render(<SectionTitle eyebrow="Test" title="Titre" tone="rose" />);
    expect(screen.getByText('Titre')).toBeInTheDocument();
  });

  it('applique la classe de tonalité rose', () => {
    const { container } = render(
      <SectionTitle eyebrow="Test" title="Titre" tone="rose" />,
    );
    const eyebrow = container.querySelector('.text-rose-700');
    expect(eyebrow).toBeTruthy();
  });

  it('applique la classe de tonalité indigo', () => {
    const { container } = render(
      <SectionTitle eyebrow="Test" title="Titre" tone="indigo" />,
    );
    const eyebrow = container.querySelector('.text-indigo-700');
    expect(eyebrow).toBeTruthy();
  });
});