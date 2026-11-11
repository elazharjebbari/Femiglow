import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeliveryBoundsProvider, formatMad, toDictionaryLanguage } from '@/lib/checkout/delivery/delivery-estimate';
import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';

const CITIES: PublicCity[] = [
  { slug: 'casablanca', nameFr: 'Casablanca', nameAr: 'الدار البيضاء', deliveryPriceMad: 19, deliveryEta: '24h', aliases: [] },
  { slug: 'marrakech', nameFr: 'Marrakech', nameAr: 'مراكش', deliveryPriceMad: 35, deliveryEta: '24h - 48h', aliases: [] },
  { slug: 'errachidia', nameFr: 'Errachidia', nameAr: 'الرشيدية', deliveryPriceMad: 45, deliveryEta: '48h - 96h', aliases: [] },
];

let freeShipping = false;
vi.mock('@/lib/checkout/use-shipping-config', () => ({
  useShippingConfig: () => ({ freeShipping, loading: false }),
}));
vi.mock('@/lib/checkout/delivery/use-delivery-cities', async (orig) => ({
  ...(await orig<typeof import('@/lib/checkout/delivery/use-delivery-cities')>()),
  useDeliveryCities: () => ({ query: '', items: CITIES, loading: false, error: null }),
}));

import { DeliveryEstimateLine } from './DeliveryEstimateLine';

function renderLine(language: 'fr' | 'ar' = 'fr', bounds: { minMad: number; maxMad: number } | null = { minMad: 19, maxMad: 45 }) {
  return render(
    <DeliveryBoundsProvider value={bounds}>
      <DeliveryEstimateLine productCents={19900} language={language} />
    </DeliveryBoundsProvider>,
  );
}

beforeEach(() => {
  freeShipping = false;
  act(() => {
    useWizardStore.getState().reset();
    useWizardStore.getState().setHydrated();
  });
});

describe('helpers', () => {
  it('formatMad : devise de la langue', () => {
    expect(formatMad(3500, 'fr')).toBe('35 MAD');
    expect(formatMad(3500, 'ar')).toBe('35 درهم');
  });
  it('toDictionaryLanguage', () => {
    expect(toDictionaryLanguage('ar')).toBe('ar');
    expect(toDictionaryLanguage('ar-MA')).toBe('ar');
    expect(toDictionaryLanguage('en')).toBe('en');
    expect(toDictionaryLanguage(undefined)).toBe('fr');
    expect(toDictionaryLanguage('fr-MA')).toBe('fr');
  });
});

describe('ligne livraison sous le prix', () => {
  it('ville inconnue : fourchette chiffrée et lien « Ma ville »', () => {
    renderLine();
    expect(screen.getByTestId('delivery-estimate-range').textContent).toBe('19 à 45 MAD selon votre ville');
    expect(screen.getByTestId('delivery-estimate-open').textContent).toBe('Ma ville');
    expect(screen.queryByTestId('delivery-estimate-total')).toBeNull();
  });

  it('sans bornes connues : jamais de montant inventé', () => {
    renderLine('fr', null);
    expect(screen.getByTestId('delivery-estimate-range').textContent).toBe('selon votre ville');
  });

  it('livraison offerte (drapeau admin) : pas de lien, pas de montant', () => {
    freeShipping = true;
    renderLine();
    expect(screen.getByTestId('delivery-estimate').textContent).toContain('Livraison offerte partout au Maroc');
    expect(screen.queryByTestId('delivery-estimate-open')).toBeNull();
  });

  it('ville déjà choisie (brouillon du formulaire) : tarif, total et « Changer »', () => {
    act(() => {
      useWizardStore.getState().mergeAddressDraft({
        city: 'Marrakech',
        citySlug: 'marrakech',
        cityNameAr: 'مراكش',
        cityDeliveryPriceMad: 35,
        cityDeliveryEta: '24h - 48h',
      });
    });
    renderLine();
    expect(screen.getByTestId('delivery-estimate').textContent).toContain('Livraison à Marrakech');
    expect(screen.getByTestId('delivery-estimate-amount').textContent).toBe('35 MAD');
    expect(screen.getByTestId('delivery-estimate-total').textContent).toContain('234 MAD');
    expect(screen.getByTestId('delivery-estimate-open').textContent).toBe('Changer');
  });

  it('arabe : sens RTL, nom de ville en arabe, devise locale', () => {
    act(() => {
      useWizardStore.getState().mergeAddressDraft({
        city: 'Marrakech',
        citySlug: 'marrakech',
        cityNameAr: 'مراكش',
        cityDeliveryPriceMad: 35,
        cityDeliveryEta: null,
      });
    });
    renderLine('ar');
    const root = screen.getByTestId('delivery-estimate');
    expect(root.getAttribute('dir')).toBe('rtl');
    expect(root.textContent).toContain('التوصيل إلى مراكش');
    expect(screen.getByTestId('delivery-estimate-total').textContent).toContain('234 درهم');
  });
});

describe('panneau « Ma ville »', () => {
  it('raccourci → récapitulatif kit + livraison + total → validation écrite dans le brouillon', () => {
    renderLine();
    fireEvent.click(screen.getByTestId('delivery-estimate-open'));
    const validate = screen.getByTestId('delivery-city-validate') as HTMLButtonElement;
    expect(validate.disabled).toBe(true);

    fireEvent.click(screen.getByTestId('delivery-city-shortcut-errachidia'));
    expect(screen.getByTestId('delivery-city-total').textContent).toBe('244 MAD');
    expect(validate.disabled).toBe(false);

    fireEvent.click(validate);
    const draft = useWizardStore.getState().addressDraft;
    expect(draft).toMatchObject({
      city: 'Errachidia',
      citySlug: 'errachidia',
      cityNameAr: 'الرشيدية',
      cityDeliveryPriceMad: 45,
      cityDeliveryEta: '48h - 96h',
    });
    // La page se met à jour sans rechargement.
    expect(screen.getByTestId('delivery-estimate-total').textContent).toContain('244 MAD');
  });

  it('les raccourcis affichent le tarif de chaque ville', () => {
    renderLine();
    fireEvent.click(screen.getByTestId('delivery-estimate-open'));
    expect(screen.getByTestId('delivery-city-shortcut-casablanca').textContent).toContain('19 MAD');
    expect(screen.getByTestId('delivery-city-shortcut-marrakech').getAttribute('aria-pressed')).toBe('false');
  });
});
