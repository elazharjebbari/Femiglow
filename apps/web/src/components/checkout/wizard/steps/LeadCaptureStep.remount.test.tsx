/**
 * Kit CRO v2 — LeadCaptureStep remonté dans le même chargement de page (wizard
 * /kit déplacé entre la page et le panneau de commande, ouvertures/fermetures
 * successives) : la bannière « Bon retour » ne réapparaît pas, et
 * `wizard_resume_shown` / `form_start` ne sont émis qu'une fois.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { emit } = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useLeadCaptureMutation: () => ({ status: 'idle', error: null, execute: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit, consent: {}, isReady: true }),
}));
vi.mock('@/lib/tracking/use-checkout-intent', () => ({
  useCheckoutIntentTrigger: () => ({ handleInputChange: () => {}, reset: () => {} }),
}));

import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { __resetFormStartGuardForTests } from '@/lib/tracking/use-form-tracking';
import { LeadCaptureStep } from './LeadCaptureStep';

function seed() {
  const s = useWizardStore.getState();
  s.reset();
  s.setFormContext({
    formId: 'wizard_kit',
    formMode: 'wizard_embed',
    variantKey: 'B',
    source: 'wizard_kit',
    language: 'fr',
  });
  s.setCartSnapshot({
    items: [{ variantId: 'pv', sku: 'K', name: 'Kit', quantity: 1, unitPriceCents: 32000 }],
    totalCents: 32000,
    currency: 'MAD',
  });
  // Visite précédente : prénom déjà saisi (draft persisté).
  s.mergeLeadDraft({ firstName: 'Salma' });
}

const calls = (name: string) => emit.mock.calls.filter(([event]) => event === name);
const banner = () => screen.queryByTestId('wizard-resume-banner');
const firstNameInput = () => document.querySelector('[name="firstName"]') as HTMLElement;

beforeEach(() => {
  seed();
  emit.mockClear();
  __resetFormStartGuardForTests();
});

afterEach(cleanup);

describe('LeadCaptureStep — remontages dans le même chargement de page', () => {
  it('bannière « Bon retour » : affichée au premier montage seulement', () => {
    const first = render(<LeadCaptureStep />);
    expect(banner()).toBeInTheDocument();
    expect(calls('wizard_resume_shown')).toHaveLength(1);
    expect(useWizardStore.getState().resumeBannerShown).toBe(true);
    first.unmount();

    // Ouverture du panneau, puis fermeture : deux remontages.
    for (let i = 0; i < 2; i += 1) {
      const again = render(<LeadCaptureStep />);
      expect(banner()).toBeNull();
      again.unmount();
    }
    expect(calls('wizard_resume_shown')).toHaveLength(1);
  });

  it('la bannière du premier montage reste visible après avoir posé le drapeau', () => {
    render(<LeadCaptureStep />);
    expect(useWizardStore.getState().resumeBannerShown).toBe(true);
    expect(banner()).toBeInTheDocument();
  });

  it('nouveau chargement de page (drapeau éphémère remis à zéro) : bannière de nouveau', () => {
    render(<LeadCaptureStep />).unmount();
    useWizardStore.setState({ resumeBannerShown: false });
    render(<LeadCaptureStep />);
    expect(banner()).toBeInTheDocument();
    expect(calls('wizard_resume_shown')).toHaveLength(2);
  });

  it('form_start : une seule fois par formulaire malgré les remontages', () => {
    const first = render(<LeadCaptureStep />);
    fireEvent.focus(firstNameInput());
    expect(calls('form_start')).toHaveLength(1);
    expect(calls('form_start')[0]![1]).toMatchObject({ form_id: 'wizard_kit' });
    first.unmount();

    const again = render(<LeadCaptureStep />);
    fireEvent.focus(firstNameInput());
    expect(calls('form_start')).toHaveLength(1);
    again.unmount();
  });
});
