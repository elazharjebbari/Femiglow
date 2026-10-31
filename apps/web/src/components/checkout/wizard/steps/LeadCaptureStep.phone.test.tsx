/**
 * Téléphone pré-rempli : l'autofill du navigateur et les contacts envoient des
 * formats que la frappe ne produit jamais. Tous doivent aboutir au même numéro.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';

const execute = vi.fn();
vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useLeadCaptureMutation: () => ({ status: 'idle', error: null, execute, reset: vi.fn() }),
}));

const { LeadCaptureStep } = await import('./LeadCaptureStep');

const phoneInput = () => screen.getByLabelText(/Téléphone/) as HTMLInputElement;

beforeEach(() => {
  execute.mockReset();
  useWizardStore.getState().reset();
  useWizardStore.setState({
    formContext: { formId: 'wizard_kit', formMode: 'wizard_embed', variantKey: 'A', source: 'wizard_kit' },
  });
});
afterEach(() => cleanup());

describe('LeadCaptureStep — numéro pré-rempli', () => {
  it.each([
    ['local', '0612345678'],
    ['local avec espaces', '06 12 34 56 78'],
    ['local avec tirets', '0612-345678'],
    ['international', '+212612345678'],
    ['international espacé', '+212 6 12 34 56 78'],
    ['international sans plus', '212612345678'],
    ['double zéro', '00212612345678'],
    ['zéro entre parenthèses', '+212 (0)6 12 34 56 78'],
    ['zéro après indicatif', '+2120612345678'],
    ['double zéro et zéro', '002120612345678'],
    ['national', '612345678'],
    ['espaces insécables', '+212 612 345 678'],
    ['chiffres arabes', '٠٦١٢٣٤٥٦٧٨'],
    ['indicatif en chiffres arabes', '+٢١٢٦١٢٣٤٥٦٧٨'],
  ])('%s', async (_name, value) => {
    render(<LeadCaptureStep />);
    fireEvent.change(phoneInput(), { target: { value } });
    await waitFor(() => expect(phoneInput().value).toBe('06 12 34 56 78'));
    expect(useWizardStore.getState().leadDraft.phone.replace(/\D/g, '')).toBe('0612345678');
    expect(screen.queryByText(/Numéro à 9 chiffres/)).not.toBeInTheDocument();
    expect(phoneInput()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('brouillon repris : le numéro reste affiché après un nouveau rendu', async () => {
    useWizardStore.getState().mergeLeadDraft({ phone: '0612345678' });
    render(<LeadCaptureStep />);
    fireEvent.change(screen.getByLabelText(/prénom/i), { target: { value: 'Salma' } });
    await waitFor(() => expect(phoneInput().value).toBe('06 12 34 56 78'));
  });

  it('un numéro vraiment invalide reste refusé', async () => {
    render(<LeadCaptureStep />);
    fireEvent.change(phoneInput(), { target: { value: '0112345678' } });
    expect(await screen.findByText(/Numéro à 9 chiffres/)).toBeInTheDocument();
  });

  it('un numéro étranger reste refusé', async () => {
    render(<LeadCaptureStep />);
    fireEvent.change(phoneInput(), { target: { value: '+33612345678' } });
    expect(await screen.findByText(/Numéro à 9 chiffres/)).toBeInTheDocument();
  });
});
