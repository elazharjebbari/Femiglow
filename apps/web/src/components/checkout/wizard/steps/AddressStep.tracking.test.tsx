/**
 * Étape 2 — mesure : ce test vérifie les événements `address_*` émis par la
 * version actuelle, et qu'aucun texte saisi n'y figure.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';

const emit = vi.fn();
const flush = vi.fn();

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit, flush, isReady: true, consent: {} }),
}));
vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useAddressMutation: () => ({ status: 'idle', error: null, execute: vi.fn(), reset: vi.fn() }),
}));
vi.mock('@/components/checkout/wizard/StockIndicator', () => ({ StockIndicator: () => null }));

const CASA: PublicCity = {
  slug: 'casablanca',
  nameFr: 'Casablanca',
  nameAr: 'الدار البيضاء',
  aliases: [],
  deliveryPriceMad: 35,
  deliveryEta: '24h-48h',
} as PublicCity;

let cities: PublicCity[] = [];
vi.mock('@/lib/checkout/delivery/use-delivery-cities', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDeliveryCities: () => ({ items: cities, loading: false }),
}));

const { AddressStep } = await import('./AddressStep');

const names = () => emit.mock.calls.map((c) => c[0] as string);
const paramsOf = (name: string) => emit.mock.calls.find((c) => c[0] === name)?.[1];

beforeEach(() => {
  emit.mockClear();
  flush.mockClear();
  cities = [];
  useWizardStore.getState().reset();
  useWizardStore.setState({
    leadId: 'lead_1',
    formContext: { formId: 'wizard_kit', formMode: 'wizard_embed', variantKey: 'A', source: 'wizard_kit' },
  });
});

describe('AddressStep — événements address_*', () => {
  it('émet la vue une seule fois, en variante control par défaut', () => {
    const { rerender } = render(<AddressStep />);
    rerender(<AddressStep />);
    expect(names().filter((n) => n === 'address_step_view')).toHaveLength(1);
    expect(paramsOf('address_step_view')).toMatchObject({ step2_variant: 'control' });
    expect(paramsOf('address_step_view').viewport_h).toEqual(expect.any(Number));
  });

  it('focus ville et adresse : un événement chacun, même après plusieurs focus', () => {
    render(<AddressStep />);
    const city = screen.getByTestId('wizard-address-city');
    const line = screen.getByTestId('wizard-address-line1');
    fireEvent.focus(city);
    fireEvent.blur(city);
    fireEvent.focus(city);
    fireEvent.focus(line);
    expect(names().filter((n) => n === 'address_city_focus')).toHaveLength(1);
    expect(names().filter((n) => n === 'address_line_focus')).toHaveLength(1);
  });

  it('ville du catalogue : slug, prix et délai, sans texte saisi', async () => {
    cities = [CASA];
    render(<AddressStep />);
    const city = screen.getByTestId('wizard-address-city');
    fireEvent.change(city, { target: { value: 'Casablanca' } });
    await waitFor(() => expect(names()).toContain('address_city_selected'));
    expect(paramsOf('address_city_selected')).toEqual({
      step2_variant: 'control',
      matched: true,
      city_slug: 'casablanca',
      delivery_price_mad: 35,
      eta: '24h-48h',
    });
  });

  it('ville hors catalogue : 45 MAD, et le nom saisi ne part pas', async () => {
    render(<AddressStep />);
    const city = screen.getByTestId('wizard-address-city');
    fireEvent.change(city, { target: { value: 'Douar Ouled X' } });
    await waitFor(() =>
      expect(useWizardStore.getState().addressDraft.city).toBe('Douar Ouled X'),
    );
    fireEvent.blur(city);
    expect(paramsOf('address_city_selected')).toEqual({
      step2_variant: 'control',
      matched: false,
      delivery_price_mad: 45,
    });
    expect(JSON.stringify(emit.mock.calls)).not.toContain('Douar');
  });

  it('tap sur le bouton grisé : mesuré, avec le champ manquant', () => {
    render(<AddressStep />);
    const area = screen.getByTestId('wizard-address-submit-area');
    expect(screen.getByTestId('wizard-address-submit')).toBeDisabled();
    fireEvent.pointerDown(area);
    expect(paramsOf('address_cta_tap_incomplete')).toEqual({
      step2_variant: 'control',
      missing_field: 'city',
    });
  });

  it('erreur de validation : champ et code, sans le texte', async () => {
    render(<AddressStep />);
    const line = screen.getByTestId('wizard-address-line1');
    fireEvent.change(line, { target: { value: 'ab' } });
    await waitFor(() => expect(names()).toContain('address_validation_error'));
    expect(paramsOf('address_validation_error')).toEqual({
      step2_variant: 'control',
      field: 'addressLine1',
      code: 'too_small',
    });
  });

  it('sortie de page : abandon avec la phase, puis envoi forcé, une seule fois', () => {
    useWizardStore.getState().mergeAddressDraft({ city: 'Fès' });
    render(<AddressStep />);
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(names().filter((n) => n === 'address_step_abandon')).toHaveLength(1);
    expect(paramsOf('address_step_abandon')).toMatchObject({
      step2_variant: 'control',
      phase: 'address',
      has_city: true,
      ms_on_step: expect.any(Number),
    });
    expect(flush).toHaveBeenCalledTimes(1);
    const order = [emit.mock.invocationCallOrder.at(-1)!, flush.mock.invocationCallOrder[0]!];
    expect(order[0]).toBeLessThan(order[1]);
  });

  it('page cachée (navigateur intégré) : abandon émis aussi', () => {
    render(<AddressStep />);
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    spy.mockRestore();
    expect(names()).toContain('address_step_abandon');
  });

  it('étape quittée dans le parcours : aucun faux abandon', () => {
    const { unmount } = render(<AddressStep />);
    unmount();
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(names()).not.toContain('address_step_abandon');
  });

  it('la variante du formContext est reprise sur les événements', () => {
    useWizardStore.setState((s) => ({
      formContext: { ...s.formContext!, step2Variant: 'v2' },
    }));
    render(<AddressStep />);
    expect(paramsOf('address_step_view')).toMatchObject({ step2_variant: 'v2' });
  });
});
