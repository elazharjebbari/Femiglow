import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders default title and message', () => {
    render(<ErrorState />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Erreur')).toBeInTheDocument();
  });

  it('overrides title and message', () => {
    render(<ErrorState title="Boom" message="Quelque chose a cassé" />);
    expect(screen.getByText('Boom')).toBeInTheDocument();
    expect(screen.getByText('Quelque chose a cassé')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(<ErrorState action={<button type="button">Retry</button>} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
