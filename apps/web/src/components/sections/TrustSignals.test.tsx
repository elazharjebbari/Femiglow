import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustSignals } from './TrustSignals';
import { expectNoAxeViolations } from '@/test/axe';

describe('TrustSignals', () => {
  it('rend trois engagements', () => {
    render(<TrustSignals />);
    expect(screen.getByText(/livraison offerte/i)).toBeInTheDocument();
    expect(screen.getByText(/retour 30/i)).toBeInTheDocument();
    expect(screen.getByText(/paiement \u00e0 la livraison/i)).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<TrustSignals />);
    await expectNoAxeViolations(container);
  });
});
