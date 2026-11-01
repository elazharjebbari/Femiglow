/**
 * @vitest-environment jsdom
 */
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markPurchaseFired, saveLastOrder } from '@/lib/stores/checkout-draft';
import { MerciClient } from './MerciClient';

const emit = vi.fn();

vi.mock('@/lib/tracking/use-tracking', () => ({ useTracking: () => ({ emit }) }));
vi.mock('./MerciOrchestrator', () => ({ MerciOrchestrator: () => null }));
vi.mock('@/components/sections/OrderHero', () => ({ OrderHero: () => null }));
vi.mock('@/components/sections/OrderRecap', () => ({ OrderRecap: () => null }));
vi.mock('@/components/sections/TimelineSteps', () => ({ TimelineSteps: () => null }));
vi.mock('@/components/sections/EditorialLetter', () => ({ EditorialLetter: () => null }));
vi.mock('@/components/sections/PreparationGesture', () => ({ PreparationGesture: () => null }));

function storeOrder(orderId: string): void {
  saveLastOrder({
    orderId,
    firstName: 'Yasmine',
    items: [],
    subtotal: 9900,
    shipping: 1900,
    total: 11800,
    address: {} as never,
    paymentMethod: 'cod',
    createdAt: new Date().toISOString(),
  } as never);
}

describe('MerciClient — idempotence de purchase', () => {
  beforeEach(() => {
    emit.mockClear();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('émet purchase si le parcours précédent ne l’a pas fait', async () => {
    storeOrder('o_1');
    render(<MerciClient orderId="o_1" />);
    await waitFor(() => expect(emit).toHaveBeenCalledTimes(1));
    expect(emit.mock.calls[0]?.[0]).toBe('purchase');
  });

  it('ne réémet pas purchase déjà marqué par CheckoutFlow', async () => {
    storeOrder('o_2');
    markPurchaseFired('o_2');
    const { container } = render(<MerciClient orderId="o_2" />);
    await waitFor(() => expect(container).toBeTruthy());
    await new Promise((r) => setTimeout(r, 20));
    expect(emit).not.toHaveBeenCalled();
  });
});
