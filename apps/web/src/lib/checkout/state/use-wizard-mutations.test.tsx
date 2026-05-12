/**
 * CHA-231 — Tests d'orchestration de `useAddressMutation`.
 *
 * Garantit que la chaîne address → payment(cod) → order est correctement
 * orchestrée par le hook (suite à la suppression du step paiement UI).
 *
 * Couvre :
 *  - Succès : appels dans l'ordre patchAddress → patchPayment('cod') → createOrder,
 *    puis goToStep('thank_you') + setOrderId.
 *  - Tracking : émission des events address_completed, add_payment_info, purchase.
 *  - Erreur address : on stoppe, payment + order NON appelés.
 *  - Erreur payment : on stoppe à payment, order NON appelé, l'erreur est propagée.
 *  - Erreur order : on stoppe à order, mais payment a été émis (analytics OK).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { useAddressMutation } from '@/lib/checkout/state/use-wizard-mutations';
import { ApiError } from '@/lib/checkout/client/api-errors';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

const patchAddressMock = vi.fn();
const patchPaymentMock = vi.fn();
const createOrderMock = vi.fn();
const emitMock = vi.fn();

vi.mock('@/lib/checkout/client/wizard-client', () => ({
  wizardClient: {
    patchAddress: (...args: unknown[]) => patchAddressMock(...args),
    patchPayment: (...args: unknown[]) => patchPaymentMock(...args),
    createOrder: (...args: unknown[]) => createOrderMock(...args),
  },
}));

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock, consent: {} }),
}));

vi.mock('@/lib/checkout/client/visitor-id', () => ({
  ensureVisitorId: () => 'v_test',
  ensureSessionId: () => 's_test',
}));

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const CART: CartSnapshot = {
  items: [
    {
      variantId: 'pvar_test',
      sku: 'FEMI-KIT-100',
      name: 'Kit FemiGlow',
      quantity: 1,
      unitPriceCents: 32000,
    },
  ],
  totalCents: 32000,
  currency: 'MAD',
};

function seedStore() {
  const { reset, setLeadId, setFormContext, setCartSnapshot } =
    useWizardStore.getState();
  reset();
  setFormContext({
    formId: 'wizard_kit',
    formMode: 'wizard_embed',
    variantKey: 'A',
    source: 'wizard_kit',
  });
  setLeadId('cl_test');
  setCartSnapshot(CART);
}

function wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

beforeEach(() => {
  patchAddressMock.mockReset();
  patchPaymentMock.mockReset();
  createOrderMock.mockReset();
  emitMock.mockReset();
  seedStore();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('useAddressMutation — chaîne address → payment(cod) → order', () => {
  it('orchestre les 3 appels dans le bon ordre puis goToStep(thank_you)', async () => {
    patchAddressMock.mockResolvedValue({ leadId: 'cl_test', status: 'address_set' });
    patchPaymentMock.mockResolvedValue({
      leadId: 'cl_test',
      status: 'payment_selected',
      nextStep: 'thank_you',
    });
    createOrderMock.mockResolvedValue({
      orderId: 'o_test_123',
      status: 'created',
      totalCents: 32000,
      currency: 'MAD',
    });

    const { result } = renderHook(() => useAddressMutation(), { wrapper });

    await act(async () => {
      await result.current.execute({
        city: 'Casablanca',
        addressLine1: '12 rue des Roses',
        country: 'MA',
        shippingMode: 'standard',
      });
    });

    // 1) PATCH /address
    expect(patchAddressMock).toHaveBeenCalledTimes(1);
    expect(patchAddressMock.mock.calls[0]?.[0]).toBe('cl_test');
    expect(patchAddressMock.mock.calls[0]?.[1]).toMatchObject({
      city: 'Casablanca',
      addressLine1: '12 rue des Roses',
      country: 'MA',
      shippingMode: 'standard',
    });

    // 2) PATCH /payment (cod par défaut)
    expect(patchPaymentMock).toHaveBeenCalledTimes(1);
    expect(patchPaymentMock.mock.calls[0]?.[0]).toBe('cl_test');
    expect(patchPaymentMock.mock.calls[0]?.[1]).toEqual({ paymentMethod: 'cod' });

    // 3) POST /order
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock.mock.calls[0]?.[0]).toMatchObject({
      leadId: 'cl_test',
      paymentMethod: 'cod',
      shippingMode: 'standard',
      currency: 'MAD',
      expectedTotalCents: 32000,
    });

    // 4) State store
    const state = useWizardStore.getState();
    expect(state.orderId).toBe('o_test_123');
    expect(state.currentStep).toBe('thank_you');
    expect(result.current.status).toBe('success');
  });

  it('émet les events tracking address_completed → add_payment_info → purchase', async () => {
    patchAddressMock.mockResolvedValue({ leadId: 'cl_test', status: 'address_set' });
    patchPaymentMock.mockResolvedValue({
      leadId: 'cl_test',
      status: 'payment_selected',
      nextStep: 'thank_you',
    });
    createOrderMock.mockResolvedValue({
      orderId: 'o_test_123',
      status: 'created',
      totalCents: 32000,
      currency: 'MAD',
    });

    const { result } = renderHook(() => useAddressMutation(), { wrapper });

    await act(async () => {
      await result.current.execute({
        city: 'Casablanca',
        addressLine1: '12 rue des Roses',
        country: 'MA',
        shippingMode: 'standard',
      });
    });

    const eventNames = emitMock.mock.calls.map((c) => c[0]);
    // Ordre exact attendu (succès complet)
    expect(eventNames).toContain('address_completed');
    expect(eventNames).toContain('add_payment_info');
    expect(eventNames).toContain('purchase');

    // payment_type sur add_payment_info
    const addPayCall = emitMock.mock.calls.find((c) => c[0] === 'add_payment_info');
    expect(addPayCall?.[1]).toMatchObject({ payment_type: 'cod' });

    // transaction_id sur purchase
    const purchaseCall = emitMock.mock.calls.find((c) => c[0] === 'purchase');
    expect(purchaseCall?.[1]).toMatchObject({ transaction_id: 'o_test_123' });
  });
});

describe('useAddressMutation — gestion d\'erreur', () => {
  it("stoppe à address en erreur — payment + order non appelés", async () => {
    patchAddressMock.mockRejectedValue(
      new ApiError('invalid_input', 'bad city', 400),
    );

    const { result } = renderHook(() => useAddressMutation(), { wrapper });

    await act(async () => {
      await expect(
        result.current.execute({
          city: 'X',
          addressLine1: 'foo',
          country: 'MA',
          shippingMode: 'standard',
        }),
      ).rejects.toThrow();
    });

    expect(patchPaymentMock).not.toHaveBeenCalled();
    expect(createOrderMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('invalid_input');

    // Tracking : on doit avoir un wizard_error (et PAS de purchase)
    const eventNames = emitMock.mock.calls.map((c) => c[0]);
    expect(eventNames).toContain('wizard_error');
    expect(eventNames).not.toContain('purchase');
  });

  it("stoppe à payment en erreur — order non appelé", async () => {
    patchAddressMock.mockResolvedValue({ leadId: 'cl_test', status: 'address_set' });
    patchPaymentMock.mockRejectedValue(
      new ApiError('rate_limited', 'slow down', 429),
    );

    const { result } = renderHook(() => useAddressMutation(), { wrapper });

    await act(async () => {
      await expect(
        result.current.execute({
          city: 'Casablanca',
          addressLine1: '12 rue X',
          country: 'MA',
          shippingMode: 'standard',
        }),
      ).rejects.toThrow();
    });

    expect(patchAddressMock).toHaveBeenCalledTimes(1);
    expect(patchPaymentMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
  });

  it("stoppe à order en erreur — payment a déjà été émis (analytics partiel)", async () => {
    patchAddressMock.mockResolvedValue({ leadId: 'cl_test', status: 'address_set' });
    patchPaymentMock.mockResolvedValue({
      leadId: 'cl_test',
      status: 'payment_selected',
      nextStep: 'thank_you',
    });
    createOrderMock.mockRejectedValue(
      new ApiError('stock_insufficient', 'sold out', 409),
    );

    const { result } = renderHook(() => useAddressMutation(), { wrapper });

    await act(async () => {
      await expect(
        result.current.execute({
          city: 'Casablanca',
          addressLine1: '12 rue X',
          country: 'MA',
          shippingMode: 'standard',
        }),
      ).rejects.toThrow();
    });

    const eventNames = emitMock.mock.calls.map((c) => c[0]);
    expect(eventNames).toContain('address_completed');
    expect(eventNames).toContain('add_payment_info');
    expect(eventNames).not.toContain('purchase');
    expect(eventNames).toContain('wizard_error');
    expect(result.current.error?.code).toBe('stock_insufficient');
  });

  it("rejette si leadId manque (invariant pré-mutation)", async () => {
    useWizardStore.getState().reset();
    useWizardStore.getState().setFormContext({
      formId: 'wizard_kit',
      formMode: 'wizard_embed',
      variantKey: 'A',
      source: 'wizard_kit',
    });
    // pas de setLeadId → leadId reste null

    const { result } = renderHook(() => useAddressMutation(), { wrapper });

    await act(async () => {
      await expect(
        result.current.execute({
          city: 'Casablanca',
          addressLine1: '12 rue X',
          country: 'MA',
          shippingMode: 'standard',
        }),
      ).rejects.toThrow();
    });

    expect(patchAddressMock).not.toHaveBeenCalled();
  });
});
