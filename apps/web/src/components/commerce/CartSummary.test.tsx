import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CartSummary } from './CartSummary';
import { useCartStore } from '@/lib/stores/cart-store';
import { expectNoAxeViolations } from '@/test/axe';

describe('CartSummary', () => {
  beforeEach(() => {
    useCartStore.setState({
      items: [
        {
          productId: 'pot',
          productSlug: 'pot',
          productName: 'Pot d\u2019or',
          unitPriceCents: 25000,
          quantity: 2,
        },
      ],
      hydrated: true,
      shippingCity: 'Casablanca',
    });
  });

  it('affiche sous-total + livraison estim\u00e9e + total', () => {
    render(<CartSummary />);
    expect(screen.getByText(/^sous-total$/i)).toBeInTheDocument();
    expect(screen.getByText(/livraison estim/i)).toBeInTheDocument();
    expect(screen.getByText(/^total$/i)).toBeInTheDocument();
    expect(screen.getByText(/^500\s?MAD$/)).toBeInTheDocument();
    expect(screen.getByText(/^40\s?MAD$/)).toBeInTheDocument();
    expect(screen.getByText(/^540\s?MAD$/)).toBeInTheDocument();
  });

  it('renvoie null si panier vide', () => {
    useCartStore.setState({ items: [], hydrated: true });
    const { container } = render(<CartSummary />);
    expect(container.firstChild).toBeNull();
  });

  it('lie le CTA Commander vers /commander', () => {
    render(<CartSummary />);
    const link = screen.getByRole('link', { name: /commander/i });
    expect(link).toHaveAttribute('href', '/commander');
  });

  it('respecte axe', async () => {
    const { container } = render(<CartSummary />);
    await expectNoAxeViolations(container);
  });
});
