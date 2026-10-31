/**
 * Étape 2 progressive : un champ à l'arrivée, l'adresse après la ville, un
 * bouton jamais grisé qui guide, et un total conforme à celui du serveur.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';
import { getWizardDictionary } from '@/lib/checkout/i18n/dictionary';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';

const execute = vi.fn();
const emit = vi.fn();
let status: 'idle' | 'loading' | 'error' = 'idle';
let mutationError: { code: string; message: string; httpStatus: number } | null = null;
let freeShipping = false;

vi.mock('@/lib/checkout/state/use-wizard-mutations', () => ({
  useAddressMutation: () => ({ status, error: mutationError, execute, reset: vi.fn() }),
}));
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit, flush: vi.fn(), isReady: true, consent: {} }),
}));
vi.mock('@/lib/checkout/use-shipping-config', () => ({
  useShippingConfig: () => ({ freeShipping }),
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

const fr = getWizardDictionary('fr').addressV2;

function seed(language: 'fr' | 'ar' | 'en' = 'fr') {
  useWizardStore.getState().reset();
  useWizardStore.setState({
    leadId: 'lead_1',
    leadDraft: { ...useWizardStore.getState().leadDraft, firstName: 'Yasmine' },
    cartSnapshot: {
      items: [
        { variantId: 'pvar_1', sku: 'KIT', name: 'Kit', quantity: 1, unitPriceCents: 19900 },
      ],
      totalCents: 19900,
      currency: 'MAD',
    },
    formContext: {
      formId: 'wizard_kit',
      formMode: 'wizard_embed',
      variantKey: 'A',
      source: 'wizard_kit',
      step2Variant: 'v2',
      language,
    },
  });
}

const cta = () => screen.getByTestId('wizard-address-submit');
const line = () => screen.getByTestId('wizard-address-line1') as HTMLInputElement;
const city = () => screen.getByTestId('wizard-address-city') as HTMLInputElement;
const reveal = () => screen.getByTestId('wizard-address-reveal');
const eventParams = (name: string) => emit.mock.calls.find((c) => c[0] === name)?.[1];

async function pickCasablanca() {
  fireEvent.focus(city());
  fireEvent.click(await screen.findByTestId('wizard-address-city-option-casablanca'));
}

async function fillReady() {
  await pickCasablanca();
  fireEvent.change(line(), { target: { value: 'Hay Salam, rue 4' } });
  await waitFor(() => expect(cta()).toHaveAttribute('data-phase', 'ready'));
}

beforeEach(() => {
  execute.mockReset();
  emit.mockClear();
  status = 'idle';
  mutationError = null;
  freeShipping = false;
  cities = [CASA];
  seed();
});

describe('AddressStepV2 — arrivée', () => {
  it('un seul champ actif, ni bloc livraison, ni note, ni total', () => {
    render(<AddressStepV2 />);
    expect(city()).toBeInTheDocument();
    expect(reveal()).toHaveAttribute('data-revealed', 'false');
    expect(reveal()).toHaveAttribute('inert');
    expect(screen.queryByTestId('wizard-shipping-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wizard-add-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wizard-action-total')).not.toBeInTheDocument();
    expect(cta()).toHaveTextContent(fr.ctaChooseCity);
  });

  it('salue par le prénom, sans prénom reste correcte', () => {
    const { unmount } = render(<AddressStepV2 />);
    expect(screen.getByTestId('wizard-progress-line')).toHaveTextContent(
      'Yasmine, plus que la livraison',
    );
    unmount();
    useWizardStore.setState((s) => ({ leadDraft: { ...s.leadDraft, firstName: '' } }));
    render(<AddressStepV2 />);
    expect(screen.getByTestId('wizard-progress-line')).toHaveTextContent('Plus que la livraison');
  });

  it('le bouton n’est jamais grisé hors envoi', () => {
    render(<AddressStepV2 />);
    expect(cta()).toBeEnabled();
  });
});

describe('AddressStepV2 — révélation', () => {
  it('ville choisie : adresse ouverte, focus dessus, frais et total affichés', async () => {
    render(<AddressStepV2 />);
    await pickCasablanca();
    expect(reveal()).toHaveAttribute('data-revealed', 'true');
    expect(reveal()).not.toHaveAttribute('inert');
    expect(document.activeElement).toBe(line());
    expect(screen.getByTestId('wizard-shipping-notice')).toHaveTextContent('Livraison en 24h-48h');
    expect(screen.getByTestId('wizard-shipping-notice')).toHaveTextContent('35 MAD');
    expect(screen.getByTestId('wizard-action-total-amount')).toHaveTextContent('234 MAD');
    expect(cta()).toHaveTextContent(fr.ctaAddAddress);
  });

  it('ville hors liste : ouverte à la sortie du champ, 45 MAD, la cliente n’est pas bloquée', async () => {
    cities = [];
    render(<AddressStepV2 />);
    fireEvent.focus(city());
    fireEvent.change(city(), { target: { value: 'Douar Ouled X' } });
    expect(reveal()).toHaveAttribute('data-revealed', 'false');
    fireEvent.blur(city());
    await waitFor(() => expect(reveal()).toHaveAttribute('data-revealed', 'true'));
    expect(screen.getByTestId('wizard-shipping-notice')).toHaveTextContent(fr.deliveryUnknown);
    expect(screen.getByTestId('wizard-shipping-notice')).toHaveTextContent('45 MAD');
    expect(screen.getByTestId('wizard-action-total-amount')).toHaveTextContent('244 MAD');

    fireEvent.change(line(), { target: { value: 'Douar centre' } });
    await waitFor(() => expect(cta()).toHaveAttribute('data-phase', 'ready'));
    fireEvent.submit(cta().closest('section')!.querySelector('form')!);
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ city: 'Douar Ouled X' });
  });

  it('pas de frais à 45 MAD pendant la frappe', async () => {
    cities = [];
    render(<AddressStepV2 />);
    fireEvent.focus(city());
    fireEvent.change(city(), { target: { value: 'Casa' } });
    expect(screen.queryByTestId('wizard-shipping-notice')).not.toBeInTheDocument();
  });

  it('ne se referme pas quand la ville est effacée, la saisie reste', async () => {
    render(<AddressStepV2 />);
    await fillReady();
    fireEvent.change(city(), { target: { value: '' } });
    await waitFor(() => expect(cta()).toHaveAttribute('data-phase', 'city'));
    expect(reveal()).toHaveAttribute('data-revealed', 'true');
    expect(line().value).toBe('Hay Salam, rue 4');
  });

  it('reprise après rechargement : valeurs et adresse visibles', () => {
    useWizardStore.getState().mergeAddressDraft({
      city: 'Casablanca',
      citySlug: 'casablanca',
      cityNameAr: 'الدار البيضاء',
      cityDeliveryPriceMad: 35,
      cityDeliveryEta: '24h-48h',
      addressLine1: 'Hay Salam, rue 4',
      notes: 'Près de la mosquée',
    });
    render(<AddressStepV2 />);
    expect(reveal()).toHaveAttribute('data-revealed', 'true');
    expect(line().value).toBe('Hay Salam, rue 4');
    expect(cta()).toHaveAttribute('data-phase', 'ready');
    expect(screen.getByDisplayValue('Près de la mosquée')).toBeInTheDocument();
  });
});

describe('AddressStepV2 — bouton', () => {
  it('tap ville vide : curseur dans la ville, aucun appel, tap mesuré', () => {
    render(<AddressStepV2 />);
    fireEvent.click(cta());
    expect(document.activeElement).toBe(city());
    expect(execute).not.toHaveBeenCalled();
    expect(eventParams('address_cta_tap_incomplete')).toMatchObject({ missing_field: 'city' });
  });

  it('tap adresse vide : curseur dans l’adresse, aucun appel', async () => {
    render(<AddressStepV2 />);
    await pickCasablanca();
    (document.activeElement as HTMLElement).blur();
    fireEvent.click(cta());
    expect(document.activeElement).toBe(line());
    expect(execute).not.toHaveBeenCalled();
    expect(eventParams('address_cta_tap_incomplete')).toMatchObject({
      missing_field: 'addressLine1',
    });
  });

  it('tap adresse trop courte : message sous le champ', async () => {
    render(<AddressStepV2 />);
    await pickCasablanca();
    fireEvent.change(line(), { target: { value: 'ab' } });
    fireEvent.click(cta());
    expect(
      await screen.findByText(getWizardDictionary('fr').address.errors.addressRequired),
    ).toBeInTheDocument();
    expect(execute).not.toHaveBeenCalled();
  });

  it('prêt : libellé de confirmation, données envoyées au serveur', async () => {
    render(<AddressStepV2 />);
    await fillReady();
    expect(cta()).toHaveTextContent(fr.ctaConfirm);
    fireEvent.submit(cta().closest('section')!.querySelector('form')!);
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0]?.[0]).toEqual({
      city: 'Casablanca',
      addressLine1: 'Hay Salam, rue 4',
      country: 'MA',
      notes: undefined,
      shippingMode: 'standard',
    });
  });

  it('double tap : une seule commande', async () => {
    let release = () => {};
    execute.mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    render(<AddressStepV2 />);
    await fillReady();
    const form = cta().closest('section')!.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(execute).toHaveBeenCalled());
    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
    expect(execute).toHaveBeenCalledTimes(1);
    release();
  });

  it('envoi : désactivé, occupé, texte traduit', () => {
    seed('ar');
    status = 'loading';
    render(<AddressStepV2 />);
    expect(cta()).toBeDisabled();
    expect(cta()).toHaveAttribute('aria-busy', 'true');
    expect(cta()).toHaveTextContent(getWizardDictionary('ar').addressV2.ctaSaving);
  });

  it('erreur réseau : message, saisie conservée, nouvel essai possible', async () => {
    status = 'error';
    mutationError = { code: 'network', message: 'x', httpStatus: 0 };
    render(<AddressStepV2 />);
    await fillReady();
    expect(screen.getByTestId('wizard-address-error')).toHaveTextContent(
      getWizardDictionary('fr').errors.networkOffline,
    );
    expect(line().value).toBe('Hay Salam, rue 4');
    expect(cta()).toBeEnabled();
  });
});

describe('AddressStepV2 — total et remises', () => {
  it('livraison offerte : « Offerte », total sans frais', async () => {
    freeShipping = true;
    render(<AddressStepV2 />);
    await pickCasablanca();
    expect(screen.getByTestId('wizard-shipping-notice')).toHaveTextContent(fr.deliveryFree);
    expect(screen.getByTestId('wizard-action-total-amount')).toHaveTextContent('199 MAD');
  });

  it('code de campagne : remise visible sous le total et total exact', async () => {
    useWizardStore.setState({ couponCode: 'GLOW99', creditCents: 9000, couponKind: 'promo' });
    render(<AddressStepV2 />);
    await pickCasablanca();
    expect(screen.getByTestId('wizard-promo-applied')).toHaveTextContent('Code GLOW99 : −90 MAD');
    expect(screen.getByTestId('wizard-action-total-amount')).toHaveTextContent('144 MAD');
    expect(screen.queryByTestId('wizard-coupon-field')).not.toBeInTheDocument();
  });

  it('sans code, le lien fidélité reste accessible après la ville', async () => {
    render(<AddressStepV2 />);
    expect(screen.queryByTestId('wizard-coupon-field')).not.toBeInTheDocument();
    await pickCasablanca();
    expect(screen.getByTestId('wizard-coupon-field')).toBeInTheDocument();
  });
});

describe('AddressStepV2 — note, langues, erreurs', () => {
  it('note repliée, ouverte sur demande et mesurée', async () => {
    render(<AddressStepV2 />);
    await pickCasablanca();
    fireEvent.click(screen.getByTestId('wizard-add-note'));
    expect(screen.getByPlaceholderText(fr.notePlaceholder)).toBeInTheDocument();
    expect(eventParams('address_note_opened')).toMatchObject({ step2_variant: 'v2' });
  });

  it('les événements portent la variante v2', () => {
    render(<AddressStepV2 />);
    expect(eventParams('address_step_view')).toMatchObject({ step2_variant: 'v2' });
  });

  it('arabe : nom de ville arabe, montant en dirham, nom canonique conservé', async () => {
    seed('ar');
    render(<AddressStepV2 />);
    await pickCasablanca();
    await waitFor(() => expect(city().value).toBe('الدار البيضاء'));
    expect(screen.getByTestId('wizard-action-total-amount')).toHaveTextContent('234 درهم');
    expect(useWizardStore.getState().addressDraft.city).toBe('Casablanca');
  });

  it.each(['fr', 'ar', 'en'] as const)('%s : les quatre libellés du bouton existent', (lang) => {
    const v2 = getWizardDictionary(lang).addressV2;
    expect(new Set([v2.ctaChooseCity, v2.ctaAddAddress, v2.ctaConfirm, v2.ctaSaving]).size).toBe(4);
  });

  it('les erreurs passent en bleu sur cette étape uniquement', () => {
    render(<AddressStepV2 />);
    const section = screen.getByTestId('wizard-step-address');
    expect(section.style.getPropertyValue('--color-petale-dark')).toBe('var(--color-notice)');
  });
});
