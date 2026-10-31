/**
 * Fiche client à jour champ par champ : ville au choix, adresse et note à la
 * sortie du champ, ce qui reste à la fermeture de page, jamais de doublon.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';

const enqueueAddressDraft = vi.fn();
vi.mock('@/lib/checkout/state/address-draft-sync', () => ({ enqueueAddressDraft }));
vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useAddressMutation: () => ({ status: 'idle', error: null, execute: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: vi.fn(), flush: vi.fn(), isReady: true, consent: {} }),
}));
vi.mock('@/components/checkout/wizard/StockIndicator', () => ({ StockIndicator: () => null }));

const CASA: PublicCity = {
  slug: 'casablanca',
  nameFr: 'Casablanca',
  nameAr: 'الدار البيضاء',
  aliases: [],
  deliveryPriceMad: 35,
  deliveryEta: '24h-48h',
};
let cities: PublicCity[] = [CASA];
vi.mock('@/lib/checkout/delivery/use-delivery-cities', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDeliveryCities: () => ({ items: cities, loading: false }),
}));

const { AddressStepV2 } = await import('./AddressStepV2');

const city = () => screen.getByTestId('wizard-address-city');
const line = () => screen.getByTestId('wizard-address-line1');
const sent = () => enqueueAddressDraft.mock.calls.map((c) => c[1]);

async function pickCasablanca() {
  fireEvent.focus(city());
  fireEvent.click(await screen.findByTestId('wizard-address-city-option-casablanca'));
}

beforeEach(() => {
  enqueueAddressDraft.mockReset();
  cities = [CASA];
  useWizardStore.getState().reset();
  useWizardStore.setState({
    leadId: 'cl_1234',
    formContext: { formId: 'wizard_kit', formMode: 'wizard_embed', variantKey: 'A', source: 'wizard_kit', step2Variant: 'v2' },
  });
});

describe('étape 2 — fiche client à jour', () => {
  it('ville choisie : envoyée aussitôt, nom canonique, une seule fois', async () => {
    render(<AddressStepV2 />);
    await pickCasablanca();
    await waitFor(() => expect(sent()).toEqual([{ city: 'Casablanca' }]));
    expect(enqueueAddressDraft.mock.calls[0]?.[0]).toBe('cl_1234');
  });

  it('sur /ar, c’est aussi le nom canonique qui part', async () => {
    useWizardStore.setState((s) => ({ formContext: { ...s.formContext!, language: 'ar' } }));
    render(<AddressStepV2 />);
    await pickCasablanca();
    await waitFor(() => expect(sent()).toEqual([{ city: 'Casablanca' }]));
  });

  it('ville hors liste : envoyée à la sortie du champ, pas à la frappe', async () => {
    cities = [];
    render(<AddressStepV2 />);
    fireEvent.focus(city());
    fireEvent.change(city(), { target: { value: 'Douar X' } });
    await waitFor(() => expect(useWizardStore.getState().addressDraft.city).toBe('Douar X'));
    expect(sent()).toEqual([]);
    fireEvent.blur(city());
    await waitFor(() => expect(sent()).toEqual([{ city: 'Douar X' }]));
  });

  it('adresse : envoyée en quittant le champ, pas à chaque lettre', async () => {
    render(<AddressStepV2 />);
    await pickCasablanca();
    enqueueAddressDraft.mockClear();
    fireEvent.change(line(), { target: { value: 'Hay' } });
    fireEvent.change(line(), { target: { value: 'Hay Salam' } });
    expect(sent()).toEqual([]);
    fireEvent.blur(line());
    await waitFor(() => expect(sent()).toEqual([{ addressLine1: 'Hay Salam' }]));
  });

  it('quitter sans rien changer : aucun envoi', async () => {
    render(<AddressStepV2 />);
    await pickCasablanca();
    fireEvent.change(line(), { target: { value: 'Hay Salam' } });
    fireEvent.blur(line());
    await waitFor(() => expect(sent()).toContainEqual({ addressLine1: 'Hay Salam' }));
    enqueueAddressDraft.mockClear();
    fireEvent.focus(line());
    fireEvent.blur(line());
    await act(async () => {
      await Promise.resolve();
    });
    expect(sent()).toEqual([]);
  });

  it('adresse corrigée puis effacée : la fiche suit', async () => {
    render(<AddressStepV2 />);
    await pickCasablanca();
    enqueueAddressDraft.mockClear();
    fireEvent.change(line(), { target: { value: 'Hay Salam' } });
    fireEvent.blur(line());
    fireEvent.change(line(), { target: { value: '' } });
    fireEvent.blur(line());
    await waitFor(() =>
      expect(sent()).toEqual([{ addressLine1: 'Hay Salam' }, { addressLine1: '' }]),
    );
  });

  it('note : envoyée en quittant le champ', async () => {
    render(<AddressStepV2 />);
    await pickCasablanca();
    fireEvent.click(screen.getByTestId('wizard-add-note'));
    const note = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: 'Sonner deux fois' } });
    fireEvent.blur(note);
    await waitFor(() => expect(sent()).toContainEqual({ notes: 'Sonner deux fois' }));
  });

  it('page quittée en pleine saisie : l’adresse part quand même', async () => {
    render(<AddressStepV2 />);
    await pickCasablanca();
    fireEvent.change(line(), { target: { value: 'Hay Salam' } });
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(sent()).toContainEqual({ addressLine1: 'Hay Salam' });
  });

  it('sans lead : rien n’est envoyé', async () => {
    useWizardStore.setState({ leadId: null });
    render(<AddressStepV2 />);
    await pickCasablanca();
    expect(sent()).toEqual([]);
  });
});
