/**
 * OWBS F01 — LeadCaptureStep : validation locale, honeypot, câblage submit.
 * On teste le VRAI formulaire (react-hook-form + leadCaptureFormSchema), du
 * point de vue utilisateur (DOM), pas l'implémentation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { LeadCaptureStep } from './LeadCaptureStep';
import { expectNoAxeViolations } from '@/test/axe';

const executeMock = vi.fn(() => Promise.resolve({ leadId: 'cl_test0000000000000000' }));
vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useLeadCaptureMutation: () => ({ status: 'idle', error: null, execute: executeMock, reset: vi.fn() }),
}));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: vi.fn(), consent: {} }),
}));
vi.mock('@/lib/tracking/use-form-tracking', () => ({
  useFormTracking: () => ({ handleFieldFocus: () => () => {} }),
}));
vi.mock('@/lib/tracking/use-checkout-intent', () => ({
  useCheckoutIntentTrigger: () => ({ handleInputChange: () => {}, reset: () => {} }),
}));

function seed() {
  const s = useWizardStore.getState();
  s.reset();
  s.setFormContext({ formId: 'wizard_kit', formMode: 'wizard_cart', variantKey: 'control', source: 'wizard_kit', language: 'fr' });
  s.setCartSnapshot({ items: [{ variantId: 'pv', sku: 'K', name: 'Kit', quantity: 1, unitPriceCents: 32000 }], totalCents: 32000, currency: 'MAD' });
}

const submit = () => screen.getByTestId('wizard-lead-submit');
const byName = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLElement;

async function fill(user: ReturnType<typeof userEvent.setup>, { firstName = 'Salma', phone = '0600000000', consent = true } = {}) {
  if (firstName) await user.type(byName('firstName'), firstName);
  // PhoneMaskInput est contrôlé (displayValue) → fireEvent.change avec la valeur
  // complète (user.type char-par-char casse le masque). cf. PhoneMaskInput.test.
  if (phone) fireEvent.change(byName('phone'), { target: { value: phone } });
  // La checkbox est DANS un <label> (sans htmlFor) → cliquer l'input double-toggle
  // sous jsdom (input + activation du label). On clique le LABEL (action réelle
  // de l'utilisatrice) → un seul toggle fiable.
  if (consent) {
    const cb = byName('consent') as HTMLInputElement;
    if (!cb.checked) fireEvent.click(cb.closest('label') ?? cb);
  }
}

beforeEach(() => {
  seed();
  executeMock.mockClear();
});

describe('LeadCaptureStep — formulaire (OWBS F01)', () => {
  it('F01-S01 — saisie valide → submit activé', async () => {
    const user = userEvent.setup();
    render(<LeadCaptureStep />);
    await fill(user);
    await waitFor(() => expect(submit()).toBeEnabled());
  });

  it('F01-S02 — prénom trop court → submit désactivé', async () => {
    const user = userEvent.setup();
    render(<LeadCaptureStep />);
    await fill(user, { firstName: 'S' });
    expect(submit()).toBeDisabled();
  });

  it('F01-S03 — téléphone trop court → submit désactivé', async () => {
    const user = userEvent.setup();
    render(<LeadCaptureStep />);
    await fill(user, { phone: '06' });
    expect(submit()).toBeDisabled();
  });

  it('F01-S05 — consentement décoché → submit désactivé', async () => {
    const user = userEvent.setup();
    render(<LeadCaptureStep />);
    await fill(user, { consent: false });
    expect(submit()).toBeDisabled();
  });

  it('F01-S04/S20 — honeypot rempli → submit désactivé (bot bloqué)', async () => {
    const user = userEvent.setup();
    render(<LeadCaptureStep />);
    await fill(user);
    await user.type(byName('website'), 'http://spam');
    await waitFor(() => expect(submit()).toBeDisabled());
  });

  it('F01 — submit valide → execute() appelé une fois', async () => {
    const user = userEvent.setup();
    render(<LeadCaptureStep />);
    await fill(user);
    await waitFor(() => expect(submit()).toBeEnabled());
    await user.click(submit());
    await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(1));
  });

  it('F01-S23 — axe 0 violation', async () => {
    const { container } = render(<LeadCaptureStep />);
    await expectNoAxeViolations(container);
  });
});
