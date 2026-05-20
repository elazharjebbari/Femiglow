import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeliveryStatusBadge } from './DeliveryStatusBadge';

describe('DeliveryStatusBadge', () => {
  it('affiche En attente pour le statut pending', () => {
    render(<DeliveryStatusBadge status="pending" />);
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });

  it('affiche Envoyé pour le statut sent', () => {
    render(<DeliveryStatusBadge status="sent" />);
    expect(screen.getByText('Envoyé')).toBeInTheDocument();
  });

  it('affiche Échec pour le statut failed', () => {
    render(<DeliveryStatusBadge status="failed" />);
    expect(screen.getByText('Échec')).toBeInTheDocument();
  });

  it('affiche Auth Postiz pour le statut auth_failed', () => {
    render(<DeliveryStatusBadge status="auth_failed" />);
    expect(screen.getByText('Auth Postiz')).toBeInTheDocument();
  });
});