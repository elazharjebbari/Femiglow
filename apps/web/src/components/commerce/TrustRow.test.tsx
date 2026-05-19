import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustRow } from './TrustRow';

describe('TrustRow', () => {
  it('rend chaque item séparé par "·" par défaut', () => {
    render(<TrustRow items={['Livraison offerte', 'Paiement à la livraison', 'Retour 30 jours']} />);
    expect(screen.getByText('Livraison offerte')).toBeInTheDocument();
    expect(screen.getByText('Paiement à la livraison')).toBeInTheDocument();
    expect(screen.getByText('Retour 30 jours')).toBeInTheDocument();
    expect(screen.getAllByText('·')).toHaveLength(2);
  });

  it('respecte le séparateur custom', () => {
    render(<TrustRow items={['A', 'B']} separator="—" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('rend un seul item sans séparateur', () => {
    render(<TrustRow items={['Solo']} />);
    expect(screen.getByText('Solo')).toBeInTheDocument();
    expect(screen.queryByText('·')).not.toBeInTheDocument();
  });

  it('ne rend rien si items vide', () => {
    const { container } = render(<TrustRow items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
