import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockModeBadge } from './MockModeBadge';

describe('MockModeBadge', () => {
  it('renders default label', () => {
    render(<MockModeBadge />);
    expect(screen.getByRole('status')).toHaveTextContent(/Mode mock/i);
  });

  it('has aria-label "Mode mock activé"', () => {
    render(<MockModeBadge />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Mode mock activé');
  });

  it('renders a custom label when provided', () => {
    render(<MockModeBadge label="Mock — démo" />);
    expect(screen.getByRole('status')).toHaveTextContent('Mock — démo');
  });

  it('exposes a data attribute for selectors', () => {
    render(<MockModeBadge />);
    expect(screen.getByRole('status')).toHaveAttribute('data-cs-mock-badge', 'true');
  });
});
