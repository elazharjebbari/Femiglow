import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';

vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useLeadCaptureMutation: () => ({ status: 'idle', error: null, execute: vi.fn(), reset: vi.fn() }),
}));

const { LeadCaptureStep } = await import('./LeadCaptureStep');
const box = () => document.querySelector('input[name="consent"]') as HTMLInputElement;

beforeEach(() => {
  useWizardStore.getState().reset();
  useWizardStore.setState({
    formContext: { formId: 'wizard_kit', formMode: 'wizard_embed', variantKey: 'A', source: 'wizard_kit' },
  });
});
afterEach(() => cleanup());

describe('LeadCaptureStep — case de rappel', () => {
  it('cochée à l’arrivée', async () => {
    render(<LeadCaptureStep />);
    await waitFor(() => expect(box().checked).toBe(true));
    expect(useWizardStore.getState().leadDraft.consent).toBe(true);
  });

  it('reste cochée après la saisie d’un champ', async () => {
    render(<LeadCaptureStep />);
    fireEvent.change(document.querySelector('input[name="firstName"]')!, { target: { value: 'Salma' } });
    await waitFor(() => expect(useWizardStore.getState().leadDraft.firstName).toBe('Salma'));
    expect(box().checked).toBe(true);
    expect(useWizardStore.getState().leadDraft.consent).toBe(true);
  });

  it('peut être décochée', async () => {
    render(<LeadCaptureStep />);
    fireEvent.click(box());
    await waitFor(() => expect(useWizardStore.getState().leadDraft.consent).toBe(false));
    expect(box().checked).toBe(false);
  });

  it('décochée puis page rechargée : revient cochée', async () => {
    useWizardStore.getState().mergeLeadDraft({ consent: false, firstName: 'Salma' });
    await useWizardStore.persist.rehydrate();
    expect(useWizardStore.getState().leadDraft).toMatchObject({ consent: true, firstName: 'Salma' });
    render(<LeadCaptureStep />);
    await waitFor(() => expect(box().checked).toBe(true));
  });

  it('décochée, wizard remonté dans la même page : le choix reste', async () => {
    const first = render(<LeadCaptureStep />);
    fireEvent.click(box());
    await waitFor(() => expect(useWizardStore.getState().leadDraft.consent).toBe(false));
    first.unmount();
    render(<LeadCaptureStep />);
    expect(box().checked).toBe(false);
  });
});
