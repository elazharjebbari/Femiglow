import { describe, it, expect, beforeEach } from 'vitest';
import {
  useCartStore,
  selectSubtotalCents,
  selectEstimatedShippingCents,
  selectTotalCents,
  selectCartCount,
} from './cart-store';

describe('cart-store selectors', () => {
  beforeEach(() => {
    useCartStore.setState({
      items: [],
      hydrated: false,
      shippingCity: undefined,
    });
  });

  it('selectSubtotalCents = somme prix * quantit\u00e9', () => {
    useCartStore.setState({
      items: [
        {
          productId: 'a',
          productSlug: 'a',
          productName: 'A',
          unitPriceCents: 25000,
          quantity: 2,
        },
        {
          productId: 'b',
          productSlug: 'b',
          productName: 'B',
          unitPriceCents: 12000,
          quantity: 1,
        },
      ],
    });
    expect(selectSubtotalCents(useCartStore.getState())).toBe(62000);
  });

  it('selectEstimatedShippingCents = 0 si panier vide', () => {
    expect(selectEstimatedShippingCents(useCartStore.getState())).toBe(0);
  });

  it('selectEstimatedShippingCents = 4000 si Casablanca', () => {
    useCartStore.setState({
      items: [
        {
          productId: 'a',
          productSlug: 'a',
          productName: 'A',
          unitPriceCents: 1000,
          quantity: 1,
        },
      ],
      shippingCity: 'Casablanca',
    });
    expect(selectEstimatedShippingCents(useCartStore.getState())).toBe(4000);
  });

  it('selectEstimatedShippingCents = 6000 par d\u00e9faut', () => {
    useCartStore.setState({
      items: [
        {
          productId: 'a',
          productSlug: 'a',
          productName: 'A',
          unitPriceCents: 1000,
          quantity: 1,
        },
      ],
      shippingCity: 'Rabat',
    });
    expect(selectEstimatedShippingCents(useCartStore.getState())).toBe(6000);
  });

  it('selectTotalCents = sous-total + livraison', () => {
    useCartStore.setState({
      items: [
        {
          productId: 'a',
          productSlug: 'a',
          productName: 'A',
          unitPriceCents: 25000,
          quantity: 1,
        },
      ],
      shippingCity: 'Casablanca',
    });
    expect(selectTotalCents(useCartStore.getState())).toBe(29000);
  });

  it('updateQuantity \u00e0 0 retire l\u2019article', () => {
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
    });
    useCartStore.getState().updateQuantity('a', 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('selectCartCount somme les quantit\u00e9s', () => {
    useCartStore.setState({
      items: [
        {
          productId: 'a',
          productSlug: 'a',
          productName: 'A',
          unitPriceCents: 1000,
          quantity: 2,
        },
        {
          productId: 'b',
          productSlug: 'b',
          productName: 'B',
          unitPriceCents: 1000,
          quantity: 3,
        },
      ],
    });
    expect(selectCartCount(useCartStore.getState())).toBe(5);
  });
});
