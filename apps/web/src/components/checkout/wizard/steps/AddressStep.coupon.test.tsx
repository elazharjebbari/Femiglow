/**
 * F09 — AddressStep : disclosure « J'ai un code de fidélité » (porte repliée + câblage store).
 *
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/09-address-disclosure.
 *
 * Setup réaliste (cf. spec) : `AddressStep` est un composant client qui lit le store Zustand et
 * appelle `useAddressMutation` + `useShippingConfig` + `useWizardTranslation` + `CityAutocomplete`
 * (fetch `/api/delivery-cities/search`). On reprend EXACTEMENT le pattern de mocks d'AddressStep.test.tsx :
 *   1. mock `useAddressMutation` (pas de vraie mutation réseau) ;
 *   2. mock `useDeliveryCities` (sinon CityAutocomplete fetch) ;
 *   3. stub `StockIndicator` ;
 *   4. on sème le store via les setters + `setCoupon` puis `reset()` en afterEach ;
 *   5. MSW `redeemHandlers` pour la validation interne du champ (POST /api/coupons/redeem).
 * On asserte sur le store (`getState().couponCode/creditCents`) plutôt que sur le total (F10).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { server, http, HttpResponse } from '@/test/msw/server';
import { redeemHandlers } from '@/test/msw/coupons-handlers';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';
import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — identiques à AddressStep.test.tsx pour isoler du réseau
// ─────────────────────────────────────────────────────────────────────────────

const executeMock = vi.fn();
const resetMock = vi.fn();
let mutationState: {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: { code: string; message: string; httpStatus: number } | null;
} = { status: 'idle', error: null };

vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useAddressMutation: () => ({
    status: mutationState.status,
    error: mutationState.error,
    execute: executeMock,
    reset: resetMock,
  }),
}));

vi.mock('@/components/checkout/wizard/StockIndicator', () => ({
  StockIndicator: () => null,
}));

let mockedCities: PublicCity[] = [];
const setMockedCities = (cities: PublicCity[]) => {
  mockedCities = cities;
};
vi.mock('@/lib/checkout/delivery/use-delivery-cities', () => ({
  useDeliveryCities: () => ({
    query: '',
    items: mockedCities,
    loading: false,
    error: null,
  }),
}));

// Importé APRÈS les mocks.
import { AddressStep } from './AddressStep';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CART: CartSnapshot = {
  items: [
    {
      variantId: 'pvar_test',
      sku: 'FEMI-KIT-100',
      name: 'Kit FemiGlow',
      quantity: 1,
      unitPriceCents: 19900,
    },
  ],
  totalCents: 19900,
  currency: 'MAD',
};

function seedStore(opts: {
  language?: 'fr' | 'ar';
  cart?: CartSnapshot | null;
  couponCode?: string | null;
  creditCents?: number;
} = {}) {
  const { reset, setFormContext, setCartSnapshot, setCoupon } = useWizardStore.getState();
  reset();
  setFormContext({
    formId: 'wizard_kit',
    formMode: 'wizard_embed',
    variantKey: 'A',
    source: 'wizard_kit',
    language: opts.language ?? 'fr',
  });
  setCartSnapshot(opts.cart ?? MOCK_CART);
  if (opts.couponCode) setCoupon(opts.couponCode, opts.creditCents ?? 0);
}

// INV-422 — oracle pur (la source du crédit vit dans le store ; l'affichage du total
// vit dans WizardCartRecap, couvert par F10). Helper local documentant la frontière :
// le total transmis à la commande = total − min(credit, total), plancher 0.
function expectedTotalCents(totalCents: number, creditCents: number): number {
  return totalCents - Math.min(creditCents, totalCents);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

// `useShippingConfig` fetch /api/checkout/shipping-config au mount ; on sert une
// config par défaut pour garder la policy MSW `onUnhandledRequest: 'error'` propre.
const shippingConfigHandler = http.get('/api/checkout/shipping-config', () =>
  HttpResponse.json({ freeShipping: true }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers(shippingConfigHandler);
  cleanup();
  useWizardStore.getState().reset();
});
afterAll(() => server.close());

beforeEach(() => {
  server.use(shippingConfigHandler);
  executeMock.mockReset();
  resetMock.mockReset();
  mutationState = { status: 'idle', error: null };
  setMockedCities([]);
  seedStore();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('F09 — AddressStep coupon disclosure', () => {
  it('F09-C001 disclosure repliée par défaut sans code en store (zéro friction)', () => {
    render(<AddressStep />);
    const details = screen.getByTestId('wizard-coupon-field') as HTMLDetailsElement;
    expect(details).toBeInTheDocument();
    expect(details.open).toBe(false);
    const summary = screen.getByTestId('wizard-coupon-summary');
    expect(summary.textContent ?? '').toContain('J’ai un code de fidélité');
  });

  it('F09-C002 disclosure ouverte d’office si couponCode présent (reprise)', () => {
    seedStore({ couponCode: 'FG-SAUGE-7212', creditCents: 2000 });
    render(<AddressStep />);
    const details = screen.getByTestId('wizard-coupon-field') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    // Le champ pré-rempli reçoit initialCode depuis le store.
    const input = screen.getByLabelText('Votre code') as HTMLInputElement;
    expect(input.value).toBe('FG-SAUGE-7212');
  });

  it('F09-C003 clic sur le summary ouvre la porte', async () => {
    render(<AddressStep />);
    const details = screen.getByTestId('wizard-coupon-field') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByTestId('wizard-coupon-summary'));
    await waitFor(() => expect(details.open).toBe(true));
  });

  it('F09-M004 validation d’un code valide câble setCoupon dans le store', async () => {
    server.use(
      ...redeemHandlers({ byCode: { 'FG-SAUGE-7212': { valid: true, valueCents: 2000 } } }),
    );
    const user = userEvent.setup();
    render(<AddressStep />);
    fireEvent.click(screen.getByTestId('wizard-coupon-summary'));
    const input = screen.getByLabelText('Votre code');
    await user.type(input, 'FG-SAUGE-7212');
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    await waitFor(() => {
      expect(useWizardStore.getState().couponCode).toBe('FG-SAUGE-7212');
      expect(useWizardStore.getState().creditCents).toBe(2000);
    });
  });

  it('F09-M005 ré-édition du code câble clearCoupon (anti-stale)', async () => {
    server.use(
      ...redeemHandlers({ byCode: { 'FG-SAUGE-7212': { valid: true, valueCents: 2000 } } }),
    );
    const user = userEvent.setup();
    render(<AddressStep />);
    fireEvent.click(screen.getByTestId('wizard-coupon-summary'));
    const input = screen.getByLabelText('Votre code');
    await user.type(input, 'FG-SAUGE-7212');
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() => expect(useWizardStore.getState().couponCode).toBe('FG-SAUGE-7212'));

    // Ré-édition : toute frappe après validation invalide → onClear → clearCoupon.
    await user.type(input, 'X');
    await waitFor(() => {
      expect(useWizardStore.getState().couponCode).toBeNull();
      expect(useWizardStore.getState().creditCents).toBe(0);
    });
  });

  it('F09-M006 code refusé ne câble aucun crédit (KO affiché)', async () => {
    server.use(...redeemHandlers({ byCode: {} })); // tout code → not_found
    const user = userEvent.setup();
    render(<AddressStep />);
    fireEvent.click(screen.getByTestId('wizard-coupon-summary'));
    const input = screen.getByLabelText('Votre code');
    await user.type(input, 'FG-NOPE');
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(await screen.findByTestId('invitation-code-ko')).toBeInTheDocument();
    expect(useWizardStore.getState().couponCode).toBeNull();
    expect(useWizardStore.getState().creditCents).toBe(0);
  });

  it('F09-U007 INV-422 : expectedTotal = total − min(credit, total)', () => {
    expect(expectedTotalCents(19900, 2000)).toBe(17900);
  });

  it('F09-U008 INV-422 : crédit supérieur au total → plancher 0', () => {
    expect(expectedTotalCents(19900, 25000)).toBe(0);
  });

  it('F09-C009 i18n arabe : summary « لدي رمز وفاء »', () => {
    seedStore({ language: 'ar' });
    render(<AddressStep />);
    const summary = screen.getByTestId('wizard-coupon-summary');
    expect(summary.textContent ?? '').toContain('لدي رمز وفاء');
  });

  it('F09-V010 charte : aucun caractère interdit dans la disclosure', () => {
    render(<AddressStep />);
    const txt = screen.getByTestId('wizard-coupon-field').textContent ?? '';
    expect(txt).not.toMatch(/[%!]|🎉|⏰/);
  });

  it('F09-C011 champ pré-rempli reçoit initialCode depuis le store', () => {
    seedStore({ couponCode: 'FG-AMBRE-3140', creditCents: 3000 });
    render(<AddressStep />);
    const input = screen.getByLabelText('Votre code') as HTMLInputElement;
    expect(input.value).toBe('FG-AMBRE-3140');
  });
});
