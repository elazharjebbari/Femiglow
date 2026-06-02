/**
 * OWBS F02 — useAddressMutation : garantie de flush avant conversion.
 *  - flag ON  : getLeadSyncQueue().flush() est awaité AVANT patchAddress (le lead
 *    créé en tâche de fond doit être persisté avant patchAddress/createOrder).
 *  - flag OFF : pas de flush (legacy, parité).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { useAddressMutation } from '@/lib/checkout/state/use-wizard-mutations';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';

const patchAddressMock = vi.fn(() => Promise.resolve());
const patchPaymentMock = vi.fn(() => Promise.resolve());
const createOrderMock = vi.fn(() => Promise.resolve({ orderId: 'ord_1', currency: 'MAD', totalCents: 32000 }));
const flushMock = vi.fn(() => Promise.resolve());

vi.mock('@/lib/checkout/client/wizard-client', () => ({
  wizardClient: {
    patchAddress: (...a: unknown[]) => patchAddressMock(...a),
    patchPayment: (...a: unknown[]) => patchPaymentMock(...a),
    createOrder: (...a: unknown[]) => createOrderMock(...a),
  },
}));
vi.mock('@/lib/checkout/state/lead-sync-singleton', () => ({
  getLeadSyncQueue: () => ({ flush: flushMock }),
}));
vi.mock('@/lib/tracking/use-tracking', () => ({ useTracking: () => ({ emit: vi.fn(), consent: {} }) }));
vi.mock('@/lib/checkout/client/visitor-id', () => ({ ensureVisitorId: () => 'v_test', ensureSessionId: () => 's_test' }));
vi.mock('@/lib/tracking/providers/hashing-browser', () => ({ hashIdentityBrowser: async () => ({}) }));

const CART: CartSnapshot = {
  items: [{ variantId: 'pv', sku: 'K', name: 'Kit', quantity: 1, unitPriceCents: 32000 }],
  totalCents: 32000,
  currency: 'MAD',
};

const FLAG = 'NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED';
const ORIG = process.env[FLAG];

function seed() {
  const s = useWizardStore.getState();
  s.reset();
  s.setFormContext({ formId: 'wizard_kit', formMode: 'wizard_cart', variantKey: 'control', source: 'wizard_kit', language: 'fr' });
  s.setCartSnapshot(CART);
  s.setLeadId('cl_test0000000000000000');
  s.mergeLeadDraft({ firstName: 'Salma', phone: '0600000000' });
}

const INPUT = { city: 'Rabat', addressLine1: '12 rue', country: 'MA', shippingMode: 'standard' as const };

beforeEach(() => {
  seed();
  [patchAddressMock, patchPaymentMock, createOrderMock, flushMock].forEach((m) => m.mockClear());
});
afterEach(() => {
  if (ORIG === undefined) delete process.env[FLAG];
  else process.env[FLAG] = ORIG;
});

describe('useAddressMutation — OWBS flush avant conversion (F02)', () => {
  it('F02-S06 — flag ON : flush() awaité AVANT patchAddress', async () => {
    process.env[FLAG] = 'true';
    const { result } = renderHook(() => useAddressMutation());
    await act(async () => {
      await result.current.execute(INPUT);
    });
    expect(flushMock).toHaveBeenCalledOnce();
    expect(patchAddressMock).toHaveBeenCalledOnce();
    // Ordre global d'invocation : flush AVANT patchAddress.
    expect(flushMock.mock.invocationCallOrder[0]!).toBeLessThan(
      patchAddressMock.mock.invocationCallOrder[0]!,
    );
  });

  it('F02-S13 — flag OFF : pas de flush (legacy)', async () => {
    process.env[FLAG] = 'false';
    const { result } = renderHook(() => useAddressMutation());
    await act(async () => {
      await result.current.execute(INPUT);
    });
    expect(flushMock).not.toHaveBeenCalled();
    expect(patchAddressMock).toHaveBeenCalledOnce();
  });
});
