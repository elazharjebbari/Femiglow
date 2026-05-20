import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttributeChips } from './AttributeChips';

describe('AttributeChips', () => {
  it('rend chaque chip dans un <li>', () => {
    render(<AttributeChips items={['Sans vernis', 'Halal']} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Sans vernis')).toBeInTheDocument();
    expect(screen.getByText('Halal')).toBeInTheDocument();
  });

  it('expose une liste avec aria-label par défaut', () => {
    render(<AttributeChips items={['A']} />);
    expect(screen.getByRole('list', { name: 'Attributs produit' })).toBeInTheDocument();
  });

  it('respecte aria-label custom', () => {
    render(<AttributeChips items={['A']} ariaLabel="Caractéristiques" />);
    expect(screen.getByRole('list', { name: 'Caractéristiques' })).toBeInTheDocument();
  });

  it('ne rend rien si items vide', () => {
    const { container } = render(<AttributeChips items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
