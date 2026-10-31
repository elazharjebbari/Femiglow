/**
 * Étape 2 en arabe et en anglais : erreurs, ville, code et envoi. Avant, les
 * erreurs et « Un instant… » restaient en français, et la ville choisie
 * s'affichait en latin sur `/ar`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { getWizardDictionary } from '@/lib/checkout/i18n/dictionary';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';

const execute = vi.fn();
let status: 'idle' | 'loading' = 'idle';

vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useAddressMutation: () => ({ status, error: null, execute, reset: vi.fn() }),
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
vi.mock('@/lib/checkout/delivery/use-delivery-cities', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDeliveryCities: () => ({ items: [CASA], loading: false }),
}));

const { AddressStep } = await import('./AddressStep');

function seed(language: 'fr' | 'ar' | 'en') {
  useWizardStore.getState().reset();
  useWizardStore.setState({
    leadId: 'lead_1',
    formContext: {
      formId: 'wizard_kit',
      formMode: 'wizard_embed',
      variantKey: 'A',
      source: 'wizard_kit',
      language,
    },
  });
}

async function pickCasablanca() {
  fireEvent.focus(screen.getByTestId('wizard-address-city'));
  fireEvent.click(await screen.findByTestId('wizard-address-city-option-casablanca'));
  await waitFor(() =>
    expect(useWizardStore.getState().addressDraft.citySlug).toBe('casablanca'),
  );
}

beforeEach(() => {
  execute.mockReset();
  status = 'idle';
});

describe('AddressStep — langues', () => {
  it('erreur de l’adresse en arabe', async () => {
    seed('ar');
    render(<AddressStep />);
    fireEvent.change(screen.getByTestId('wizard-address-line1'), { target: { value: 'ab' } });
    const message = getWizardDictionary('ar').address.errors.addressRequired;
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('erreur de l’adresse en anglais', async () => {
    seed('en');
    render(<AddressStep />);
    fireEvent.change(screen.getByTestId('wizard-address-line1'), { target: { value: 'ab' } });
    expect(await screen.findByText('Enter your area or street.')).toBeInTheDocument();
  });

  it('ville choisie sur /ar : nom arabe affiché, tarif conservé, nom canonique envoyé', async () => {
    seed('ar');
    render(<AddressStep />);
    await pickCasablanca();
    const city = screen.getByTestId('wizard-address-city') as HTMLInputElement;
    await waitFor(() => expect(city.value).toBe('الدار البيضاء'));
    expect(useWizardStore.getState().addressDraft).toMatchObject({
      city: 'Casablanca',
      citySlug: 'casablanca',
      cityDeliveryPriceMad: 35,
    });

    fireEvent.change(screen.getByTestId('wizard-address-line1'), {
      target: { value: 'حي السلام زنقة 4' },
    });
    await waitFor(() => expect(screen.getByTestId('wizard-address-submit')).toBeEnabled());
    fireEvent.click(screen.getByTestId('wizard-address-submit'));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ city: 'Casablanca' });
  });

  it('ville modifiée après coup sur /ar : le tarif périmé est retiré', async () => {
    seed('ar');
    render(<AddressStep />);
    await pickCasablanca();
    fireEvent.change(screen.getByTestId('wizard-address-city'), { target: { value: 'وجدة' } });
    await waitFor(() =>
      expect(useWizardStore.getState().addressDraft).toMatchObject({
        citySlug: null,
        cityDeliveryPriceMad: null,
      }),
    );
  });

  it('sur /fr, la ville reste en français', async () => {
    seed('fr');
    render(<AddressStep />);
    await pickCasablanca();
    expect((screen.getByTestId('wizard-address-city') as HTMLInputElement).value).toBe(
      'Casablanca',
    );
  });

  it('envoi en cours : texte du bouton traduit', () => {
    seed('ar');
    status = 'loading';
    render(<AddressStep />);
    const button = screen.getByTestId('wizard-address-submit');
    expect(button).toHaveTextContent(getWizardDictionary('ar').common.processing);
    expect(button).not.toHaveTextContent('Un instant');
  });

  it('lien du code de fidélité en anglais', () => {
    seed('en');
    render(<AddressStep />);
    expect(screen.getByTestId('wizard-coupon-summary')).toHaveTextContent('I have a loyalty code');
  });

  it('code de campagne en anglais', () => {
    seed('en');
    useWizardStore.setState({ couponCode: 'GLOW99', creditCents: 9000, couponKind: 'promo' });
    render(<AddressStep />);
    expect(screen.getByTestId('wizard-promo-applied')).toHaveTextContent(
      'Code GLOW99 applied — 90 MAD off your total.',
    );
  });
});
