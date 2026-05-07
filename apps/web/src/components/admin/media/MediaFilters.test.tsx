import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MediaFilters } from './MediaFilters';

describe('MediaFilters', () => {
  it('rend les champs de recherche, type, statut, tri', () => {
    render(<MediaFilters filters={{}} />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Statut')).toBeInTheDocument();
    expect(screen.getByLabelText('Tri')).toBeInTheDocument();
    expect(screen.getByLabelText('Hero uniquement')).toBeInTheDocument();
    expect(screen.getByLabelText('Inutilisés')).toBeInTheDocument();
  });

  it('reflète les valeurs par défaut', () => {
    render(<MediaFilters filters={{ q: 'test', kind: 'video', status: 'ready' }} />);
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('test');
  });

  it('zéro violation a11y', async () => {
    const { container } = render(<MediaFilters filters={{}} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
