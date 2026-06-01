/**
 * OWBS P3.2 — `useLeadCaptureMutation` : transition optimiste vs legacy.
 *  - TST-U-16 : flag OFF → await wizardClient.createLead (legacy), puis goToStep.
 *  - TST-U-15 : flag ON  → leadId client + enqueue (file) + goToStep SANS appeler
 *    createLead (l'UI avance sans attendre le réseau).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { useLeadCaptureMutation } from '@/lib/checkout/state/use-wizard-mutations';

const createLeadMock = vi.fn();
const enqueueMock = vi.fn();
const flushMock = vi.fn(() => Promise.resolve());

vi.mock('@/lib/checkout/client/wizard-client', () => ({
  wizardClient: { createLead: (...a: unknown[]) => createLeadMock(...a) },
}));
vi.mock('@/lib/checkout/state/lead-sync-singleton', () => ({
  getLeadSyncQueue: () => ({ enqueue: enqueueMock, flush: flushMock }),
}));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: vi.fn(), consent: {} }),
}));
vi.mock('@/lib/checkout/client/visitor-id', () => ({
  ensureVisitorId: () => 'v_test',
  ensureSessionId: () => 's_test',
}));
vi.mock('@/lib/tracking/providers/hashing-browser', () => ({
  hashIdentityBrowser: async () => ({}),
}));

const FLAG = 'NEXT_PUBLIC_CHECKOUT_OPTIMISTIC_WIZARD_ENABLED';
const ORIG = process.env[FLAG];

function seedStore() {
  const s = useWizardStore.getState();
  s.reset();
  s.setFormContext({
    formId: 'wizard_kit',
    formMode: 'wizard_embed',
    variantKey: 'A',
    source: 'wizard_kit',
    language: 'fr',
  });
  s.setCartSnapshot({
    items: [
      { variantId: 'pvar_test', sku: 'FEMI-KIT-100', name: 'Kit FemiGlow', quantity: 1, unitPriceCents: 32000 },
    ],
    totalCents: 32000,
    currency: 'MAD',
  });
}

const INPUT = { firstName: 'Salma', phone: '600000000', consent: true as const, consentVersion: 'v1' };

beforeEach(() => {
  seedStore();
  createLeadMock.mockReset();
  enqueueMock.mockReset();
  flushMock.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  if (ORIG === undefined) delete process.env[FLAG];
  else process.env[FLAG] = ORIG;
});

describe('useLeadCaptureMutation — OWBS optimiste', () => {
  it('TST-U-16 — flag OFF → legacy (await createLead), goToStep address', async () => {
    process.env[FLAG] = 'false';
    createLeadMock.mockResolvedValue({ leadId: 'cl_serverside0000000000' });

    const { result } = renderHook(() => useLeadCaptureMutation());
    let out: { leadId: string } | undefined;
    await act(async () => {
      out = await result.current.execute(INPUT);
    });

    expect(createLeadMock).toHaveBeenCalledOnce();
    expect(enqueueMock).not.toHaveBeenCalled();
    expect(out).toEqual({ leadId: 'cl_serverside0000000000' });
    expect(useWizardStore.getState().currentStep).toBe('address');
  });

  it('TST-U-15 — flag ON → optimiste : enqueue + goToStep, SANS appeler createLead', async () => {
    process.env[FLAG] = 'true';

    const { result } = renderHook(() => useLeadCaptureMutation());
    let out: { leadId: string } | undefined;
    await act(async () => {
      out = await result.current.execute(INPUT);
    });

    expect(createLeadMock).not.toHaveBeenCalled();
    expect(enqueueMock).toHaveBeenCalledOnce();
    const env = enqueueMock.mock.calls[0]![0] as { scope: string; leadId: string; endpoint: string };
    expect(env.scope).toBe('lead_create');
    expect(env.endpoint).toBe('/api/checkout/lead');
    expect(env.leadId).toMatch(/^cl_[0-9a-z]{20,}$/);
    expect(out!.leadId).toBe(env.leadId);
    expect(useWizardStore.getState().currentStep).toBe('address');
    expect(useWizardStore.getState().leadId).toBe(env.leadId);
  });
});
