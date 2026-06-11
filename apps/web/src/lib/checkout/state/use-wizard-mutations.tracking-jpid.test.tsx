/**
 * Parité tracking lead→Meta Purchase (jpid) dans le wizard `/kit`.
 *
 * Régression : le wizard OWBS (`use-wizard-mutations`) n'émettait que
 * `lead_capture` — PAS de `generate_lead` ni de `meta_purchase_eid` — alors que
 * le `CheckoutFlow` legacy portait le pont lead→Meta Purchase. Sans cela :
 *  - le lead du wizard n'était jamais compté comme Purchase Meta ;
 *  - l'achat réel ne portait pas le jpid → double Purchase CAPI possible si le
 *    ledger serveur est perdu (restart).
 *
 * Ces tests verrouillent la parité :
 *  - à l'étape lead : `generate_lead` (`method:'abandoned_cart'`) + le jpid sur
 *    `lead_capture` ET `generate_lead` ;
 *  - à l'achat : `purchase` porte le MÊME jpid (lu, non recréé).
 *
 * Le pont est gardé par `NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED` : OFF →
 * aucun `meta_purchase_eid` émis (comportement legacy strict).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import {
  useLeadCaptureMutation,
  useAddressMutation,
} from '@/lib/checkout/state/use-wizard-mutations';
import { LEAD_PURCHASE_COOKIE } from '@/lib/tracking/lead-purchase-cookie';

const createLeadMock = vi.fn();
const patchAddressMock = vi.fn();
const patchPaymentMock = vi.fn();
const createOrderMock = vi.fn();
const emitMock = vi.fn();

vi.mock('@/lib/checkout/client/wizard-client', () => ({
  wizardClient: {
    createLead: (...a: unknown[]) => createLeadMock(...a),
    patchAddress: (...a: unknown[]) => patchAddressMock(...a),
    patchPayment: (...a: unknown[]) => patchPaymentMock(...a),
    createOrder: (...a: unknown[]) => createOrderMock(...a),
  },
}));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock, consent: {} }),
}));
vi.mock('@/lib/checkout/client/visitor-id', () => ({
  ensureVisitorId: () => 'v_test',
  ensureSessionId: () => 's_test',
}));
vi.mock('@/lib/tracking/providers/hashing-browser', () => ({
  hashIdentityBrowser: async () => ({}),
}));

const PURCHASE_FLAG = 'NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED';
const OPTIMISTIC_FLAG = 'NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED';
const ORIG_PURCHASE = process.env[PURCHASE_FLAG];
const ORIG_OPTIMISTIC = process.env[OPTIMISTIC_FLAG];

function seedStore() {
  const s = useWizardStore.getState();
  s.reset();
  s.setFormContext({
    formId: 'wizard_kit',
    formMode: 'wizard_embed',
    variantKey: 'A',
    source: 'wizard_kit',
  });
  s.setCartSnapshot({
    items: [
      { variantId: 'pvar_test', sku: 'FEMI-KIT-100', name: 'Kit FemiGlow', quantity: 1, unitPriceCents: 32000 },
    ],
    totalCents: 32000,
    currency: 'MAD',
  });
}

function clearCookie() {
  document.cookie = `${LEAD_PURCHASE_COOKIE}=; max-age=0; path=/`;
}

const LEAD_INPUT = { firstName: 'Salma', phone: '600000000', consent: true as const, consentVersion: 'v1' };

beforeEach(() => {
  createLeadMock.mockReset();
  patchAddressMock.mockReset();
  patchPaymentMock.mockReset();
  createOrderMock.mockReset();
  emitMock.mockReset();
  clearCookie();
  seedStore();
  // Legacy lead path (await createLead) — découple le test du chemin optimiste.
  process.env[OPTIMISTIC_FLAG] = 'false';
});
afterEach(() => {
  if (ORIG_PURCHASE === undefined) delete process.env[PURCHASE_FLAG];
  else process.env[PURCHASE_FLAG] = ORIG_PURCHASE;
  if (ORIG_OPTIMISTIC === undefined) delete process.env[OPTIMISTIC_FLAG];
  else process.env[OPTIMISTIC_FLAG] = ORIG_OPTIMISTIC;
  clearCookie();
});

describe('wizard /kit — pont lead→Meta Purchase (jpid), flag ON', () => {
  beforeEach(() => {
    process.env[PURCHASE_FLAG] = 'true';
  });

  it('lead : émet generate_lead (abandoned_cart) + jpid partagé sur lead_capture ET generate_lead', async () => {
    createLeadMock.mockResolvedValue({ leadId: 'cl_serverside00000000' });

    const { result } = renderHook(() => useLeadCaptureMutation());
    await act(async () => {
      await result.current.execute(LEAD_INPUT);
    });

    const leadCapture = emitMock.mock.calls.find((c) => c[0] === 'lead_capture');
    const generateLead = emitMock.mock.calls.find((c) => c[0] === 'generate_lead');

    // generate_lead est l'event que le serveur traite comme Purchase Meta.
    expect(generateLead).toBeDefined();
    const jpid = (generateLead?.[1] as { meta_purchase_eid?: string }).meta_purchase_eid;
    expect(typeof jpid).toBe('string');
    expect(jpid).toBeTruthy();
    expect(generateLead?.[1]).toMatchObject({
      method: 'abandoned_cart',
      value: 320,
      currency: 'MAD',
    });

    // Même jpid sur lead_capture → dédup native Meta (Pixel↔CAPI).
    expect(leadCapture).toBeDefined();
    expect((leadCapture?.[1] as { meta_purchase_eid?: string }).meta_purchase_eid).toBe(jpid);

    // Cookie de parcours posé (bloque le pixel de l'achat réel + fallback CAPI).
    expect(document.cookie).toContain(`${LEAD_PURCHASE_COOKIE}=${jpid}`);
  });

  it('purchase : réutilise le MÊME jpid que le lead (dédup achat réel ↔ lead)', async () => {
    createLeadMock.mockResolvedValue({ leadId: 'cl_serverside00000000' });
    patchAddressMock.mockResolvedValue({ leadId: 'cl_serverside00000000', status: 'address_set' });
    patchPaymentMock.mockResolvedValue({ leadId: 'cl_serverside00000000', status: 'payment_selected', nextStep: 'thank_you' });
    createOrderMock.mockResolvedValue({ orderId: 'o_test_123', status: 'created', totalCents: 32000, currency: 'MAD' });

    // 1) Lead (pose le cookie jpid).
    const lead = renderHook(() => useLeadCaptureMutation());
    await act(async () => {
      await lead.result.current.execute(LEAD_INPUT);
    });
    const jpid = (emitMock.mock.calls.find((c) => c[0] === 'generate_lead')?.[1] as { meta_purchase_eid?: string }).meta_purchase_eid;
    expect(jpid).toBeTruthy();

    // 2) Achat (chaîne address→payment→order→purchase).
    const order = renderHook(() => useAddressMutation());
    await act(async () => {
      await order.result.current.execute({
        city: 'Casablanca',
        addressLine1: '12 rue des Roses',
        country: 'MA',
        shippingMode: 'standard',
      });
    });

    const purchase = emitMock.mock.calls.find((c) => c[0] === 'purchase');
    expect(purchase).toBeDefined();
    expect((purchase?.[1] as { meta_purchase_eid?: string }).meta_purchase_eid).toBe(jpid);
  });
});

describe('wizard /kit — pont lead→Meta Purchase, flag OFF (parité legacy stricte)', () => {
  beforeEach(() => {
    process.env[PURCHASE_FLAG] = 'false';
  });

  it('aucun meta_purchase_eid émis (ni lead_capture, ni generate_lead, ni purchase)', async () => {
    createLeadMock.mockResolvedValue({ leadId: 'cl_serverside00000000' });

    const { result } = renderHook(() => useLeadCaptureMutation());
    await act(async () => {
      await result.current.execute(LEAD_INPUT);
    });

    for (const call of emitMock.mock.calls) {
      const params = call[1] as { meta_purchase_eid?: string } | undefined;
      expect(params?.meta_purchase_eid).toBeUndefined();
    }
    // generate_lead reste émis (signal GA4), mais sans jpid.
    const generateLead = emitMock.mock.calls.find((c) => c[0] === 'generate_lead');
    expect(generateLead).toBeDefined();
    expect(document.cookie).not.toContain(LEAD_PURCHASE_COOKIE);
  });
});
