import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CartHero } from './CartHero';
import { useCartStore } from '@/lib/stores/cart-store';
import { expectNoAxeViolations } from '@/test/axe';

describe('CartHero', () => {
  beforeEach(() => {
    useCartStore.setState({
      items: [],
      hydrated: true,
      shippingCity: undefined,
    });
  });

  it('rend un h1 « Votre panier. »', () => {
    render(<CartHero />);
    expect(
      screen.getByRole('heading', { level: 1, name: /^Votre panier\.$/i }),
    ).toBeInTheDocument();
  });

  it('annonce le pluriel quand 2 articles', () => {
    useCartStore.setState({
      items: [
        {
          productId: 'a',
          productSlug: 'a',
          productName: 'A',
          unitPriceCents: 1000,
          quantity: 2,
        },
      ],
      hydrated: true,
    });
    render(<CartHero />);
    expect(screen.getByText(/2 articles/i)).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<CartHero />);
    await expectNoAxeViolations(container);
  });
});
