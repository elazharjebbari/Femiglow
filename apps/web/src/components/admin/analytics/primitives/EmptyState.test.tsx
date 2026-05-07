import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders default title and message', () => {
    render(<EmptyState />);
    expect(screen.getByText('Aucune donnée')).toBeInTheDocument();
  });

  it('uses custom title and message', () => {
    render(<EmptyState title="Vide" message="Rien à afficher" />);
    expect(screen.getByText('Vide')).toBeInTheDocument();
    expect(screen.getByText('Rien à afficher')).toBeInTheDocument();
  });

  it('renders optional action node', () => {
    render(<EmptyState action={<button type="button">Réessayer</button>} />);
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('exposes role=status for assistive tech', () => {
    render(<EmptyState />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
