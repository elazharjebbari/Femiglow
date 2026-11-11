'use client';

/**
 * Livraison annoncée sur la page /kit, avant le formulaire (« Ma ville »).
 *
 * Source unique : la ville choisie est écrite dans le brouillon d'adresse du
 * formulaire (`addressDraft`, persisté sur l'appareil). La page et l'étape 2
 * lisent et écrivent le même brouillon : une ville choisie sous le prix n'est
 * plus redemandée à l'étape 2, et inversement.
 *
 * Les bornes « 19 à 45 MAD » viennent de la base (villes actives) via
 * `DeliveryBoundsProvider`, posé par le layout /kit. Sans bornes, on retombe
 * sur « selon votre ville », jamais sur un montant inventé.
 *
 * Audit /kit du 10/11/2026 : des clientes découvraient les frais à l'étape 2.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';
import {
  getWizardDictionary,
  type DictionaryLanguage,
} from '@/lib/checkout/i18n/dictionary';
import { shippingCentsFromPrice } from '@/lib/checkout/shipping-fee';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { useShippingConfig } from '@/lib/checkout/use-shipping-config';

export interface DeliveryBounds {
  minMad: number;
  maxMad: number;
}

const DeliveryBoundsContext = createContext<DeliveryBounds | null>(null);

export function DeliveryBoundsProvider({
  value,
  children,
}: {
  value: DeliveryBounds | null;
  children: ReactNode;
}) {
  return <DeliveryBoundsContext.Provider value={value}>{children}</DeliveryBoundsContext.Provider>;
}

export function useDeliveryBounds(): DeliveryBounds | null {
  return useContext(DeliveryBoundsContext);
}

/** Langue d'affichage d'une locale de route (`fr`, `ar`, `en`, `fr-MA`…). */
export function toDictionaryLanguage(locale: string | undefined): DictionaryLanguage {
  if (locale?.startsWith('ar')) return 'ar';
  if (locale?.startsWith('en')) return 'en';
  return 'fr';
}

/** Montant entier avec la devise de la langue (« 35 MAD », « 35 درهم »). */
export function formatMad(cents: number, language: DictionaryLanguage): string {
  const currency = getWizardDictionary(language).cartRecap.currency;
  return `${Math.round(cents / 100)} ${currency}`;
}

/** Ville choisie, telle que la page et le formulaire l'enregistrent. */
export function deliveryDraftFromCity(city: PublicCity) {
  return {
    city: city.nameFr,
    citySlug: city.slug,
    cityNameAr: city.nameAr,
    cityDeliveryPriceMad: city.deliveryPriceMad,
    cityDeliveryEta: city.deliveryEta,
  };
}

export interface DeliveryEstimate {
  /** Brouillon relu : avant, rien n'est affiché de spécifique à l'appareil. */
  hydrated: boolean;
  /** Ville reconnue (choisie dans la liste) : tarif exact connu. */
  known: boolean;
  /** Nom à afficher, dans la langue de la page. */
  cityName: string | null;
  eta: string | null;
  freeShipping: boolean;
  shippingCents: number | null;
  /** Prix du kit + livraison, ou `null` tant que la ville est inconnue. */
  totalCents: number | null;
  /** « 19 à 45 MAD selon votre ville » (ou le libellé sans montant). */
  rangeLabel: string;
}

/**
 * État de la livraison pour un prix de kit donné (centimes, remises déduites).
 */
export function useDeliveryEstimate(
  productCents: number,
  language: DictionaryLanguage,
): DeliveryEstimate {
  const hydrated = useWizardStore((s) => s.hydrated);
  const draft = useWizardStore((s) => s.addressDraft);
  const bounds = useDeliveryBounds();
  const { freeShipping } = useShippingConfig();

  return useMemo(() => {
    const t = getWizardDictionary(language).deliveryEstimate;
    const rangeLabel = freeShipping
      ? t.free
      : bounds
        ? bounds.minMad === bounds.maxMad
          ? formatMad(bounds.minMad * 100, language)
          : t.range(String(bounds.minMad), formatMad(bounds.maxMad * 100, language))
        : t.rangeUnknown;
    const known = hydrated && Boolean(draft.citySlug) && draft.cityDeliveryPriceMad !== null;
    if (!known) {
      return {
        hydrated,
        known: false,
        cityName: null,
        eta: null,
        freeShipping,
        shippingCents: freeShipping ? 0 : null,
        totalCents: freeShipping ? productCents : null,
        rangeLabel,
      };
    }
    const shippingCents = shippingCentsFromPrice(draft.cityDeliveryPriceMad, freeShipping);
    const cityName =
      language === 'ar' && draft.cityNameAr ? draft.cityNameAr : draft.city || null;
    return {
      hydrated,
      known: true,
      cityName,
      eta: draft.cityDeliveryEta,
      freeShipping,
      shippingCents,
      totalCents: productCents + shippingCents,
      rangeLabel,
    };
  }, [hydrated, draft, bounds, freeShipping, productCents, language]);
}
