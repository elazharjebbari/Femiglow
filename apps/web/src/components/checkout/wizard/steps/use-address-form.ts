'use client';

/**
 * Étape 2 du wizard — logique commune à `AddressStep` et `AddressStepV2` :
 * formulaire, brouillon, ville et son tarif, envoi, erreurs, mesure. Les deux
 * versions ne peuvent ainsi pas diverger sur ce que la cliente paie ou sur ce
 * qui part au serveur ; seul l'écran change.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';

import {
  buildAddressFormSchema,
  type AddressFormValues,
} from '@/lib/checkout/address/address-form-schema';
import {
  deriveAddressPhase,
  isAddressCityValid,
} from '@/lib/checkout/address/address-phase';
import { useAddressStepTracking } from '@/lib/checkout/address/use-address-step-tracking';
import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';
import { useWizardTranslation } from '@/lib/checkout/i18n/use-wizard-translation';
import { DEFAULT_DELIVERY_PRICE_MAD } from '@/lib/checkout/shipping-fee';
import { enqueueAddressDraft } from '@/lib/checkout/state/address-draft-sync';
import { useAddressMutation } from '@/lib/checkout/state/use-wizard-mutations';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';

interface UseAddressFormOptions {
  /** Moment de la validation : à la frappe, ou à la sortie du champ. */
  validationMode: 'onChange' | 'onTouched';
  /** Soumission refusée (touche Entrée sur un formulaire incomplet). */
  onInvalid?: () => void;
  /** Le champ adresse est-il à l'écran ? (révélation progressive de la V2) */
  isAddressRevealed?: () => boolean;
  /** La ville suffit à commander. Le serveur accepte déjà une adresse vide. */
  addressOptional?: boolean;
}

export function useAddressForm({
  validationMode,
  onInvalid,
  isAddressRevealed,
  addressOptional = false,
}: UseAddressFormOptions) {
  const { t, language } = useWizardTranslation();
  const addressDraft = useWizardStore((s) => s.addressDraft);
  const mergeAddressDraft = useWizardStore((s) => s.mergeAddressDraft);

  const mutation = useAddressMutation();
  const submitting = mutation.status === 'loading';

  // Lu au moment de l'abandon, jamais à chaque rendu.
  const submittingRef = useRef(false);
  submittingRef.current = submitting;
  const isAddressRevealedRef = useRef(isAddressRevealed);
  isAddressRevealedRef.current = isAddressRevealed;

  const tracking = useAddressStepTracking(() => {
    const { city, addressLine1 } = useWizardStore.getState().addressDraft;
    return {
      phase: deriveAddressPhase({
        city,
        addressLine1,
        addressRevealed: isAddressRevealedRef.current?.() ?? true,
        addressOptional,
        submitting: submittingRef.current,
      }),
      hasCity: isAddressCityValid(city),
    };
  });
  const { trackCitySelected, trackValidationError } = tracking;

  const addressFormSchema = useMemo(
    () => buildAddressFormSchema(t.address.errors, { addressOptional }),
    [t.address.errors, addressOptional],
  );

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    mode: validationMode,
    defaultValues: {
      city: addressDraft.city ?? '',
      addressLine1: addressDraft.addressLine1 ?? '',
      notes: addressDraft.notes ?? '',
    },
  });
  const {
    watch,
    setValue,
    getValues,
    handleSubmit,
    formState: { errors },
  } = form;

  // Persistance du draft (resume après refresh).
  const watchedCity = watch('city');
  const watchedLine1 = watch('addressLine1');
  const watchedNotes = watch('notes');
  useEffect(() => {
    mergeAddressDraft({
      city: typeof watchedCity === 'string' ? watchedCity : '',
      addressLine1: typeof watchedLine1 === 'string' ? watchedLine1 : '',
      notes: typeof watchedNotes === 'string' ? watchedNotes : '',
      // CHA-231 : mode unique forcé côté UI — on garde le champ pour le payload
      // serveur mais l'utilisateur n'a plus le choix.
      shippingMode: 'standard',
    });
  }, [watchedCity, watchedLine1, watchedNotes, mergeAddressDraft]);

  // Fiche client à jour champ par champ : le panier abandonné porte ainsi la
  // ville et l'adresse déjà saisies. N'envoie que ce qui a changé.
  const leadId = useWizardStore((s) => s.leadId);
  const sentDraftRef = useRef({ city: '', addressLine1: '', notes: '' });
  const saveDraftField = useCallback(
    (field: 'city' | 'addressLine1' | 'notes', raw: string | undefined) => {
      const value = (raw ?? '').trim();
      if (!leadId || value === sentDraftRef.current[field]) return;
      if (field === 'city' && !isAddressCityValid(value)) return;
      sentDraftRef.current[field] = value;
      enqueueAddressDraft(leadId, { [field]: value });
    },
    [leadId],
  );
  const onLineBlur = () => saveDraftField('addressLine1', getValues('addressLine1'));
  const onNotesBlur = () => saveDraftField('notes', getValues('notes'));

  // Page quittée en pleine saisie : aucun `blur` n'arrive.
  useEffect(() => {
    const saveAll = () => {
      saveDraftField('addressLine1', getValues('addressLine1'));
      saveDraftField('notes', getValues('notes'));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveAll();
    };
    window.addEventListener('pagehide', saveAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', saveAll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [getValues, saveDraftField]);

  // Callback de commit : appelé quand l'utilisateur sélectionne une ville
  // depuis le listbox du combobox. On met à jour le formulaire ET le store
  // pour persister les champs cached (citySlug + cityNameAr + prix + ETA).
  const onCitySelected = (city: PublicCity) => {
    trackCitySelected({
      slug: city.slug,
      matched: true,
      priceMad: city.deliveryPriceMad,
      eta: city.deliveryEta,
    });
    setValue('city', city.nameFr, { shouldValidate: true, shouldDirty: true });
    saveDraftField('city', city.nameFr);
    mergeAddressDraft({
      city: city.nameFr,
      citySlug: city.slug,
      cityNameAr: city.nameAr,
      cityDeliveryPriceMad: city.deliveryPriceMad,
      cityDeliveryEta: city.deliveryEta,
    });
  };

  // Texte saisi = nom exact d'une ville (sans clic dans le listbox) : on
  // applique son tarif sans toucher au texte. Le serveur fait le même match.
  const onCityMatched = useCallback(
    (city: PublicCity) => {
      trackCitySelected({
        slug: city.slug,
        matched: true,
        priceMad: city.deliveryPriceMad,
        eta: city.deliveryEta,
      });
      saveDraftField('city', city.nameFr);
      if (useWizardStore.getState().addressDraft.citySlug === city.slug) return;
      mergeAddressDraft({
        citySlug: city.slug,
        cityNameAr: city.nameAr,
        cityDeliveryPriceMad: city.deliveryPriceMad,
        cityDeliveryEta: city.deliveryEta,
      });
    },
    [mergeAddressDraft, saveDraftField, trackCitySelected],
  );

  // Ville hors catalogue : le serveur applique le tarif par défaut.
  const onCityBlur = () => {
    const { city, citySlug } = useWizardStore.getState().addressDraft;
    if (citySlug || !isAddressCityValid(city)) return;
    saveDraftField('city', city);
    trackCitySelected({ matched: false, priceMad: DEFAULT_DELIVERY_PRICE_MAD });
  };

  // Ville choisie HORS du formulaire (panneau « Ma ville » de la page, alors
  // que l'étape 2 est déjà ouverte) : le brouillon change, le champ suit.
  // Seul un changement du brouillon déclenche ce report, jamais la frappe.
  const lastDraftCityRef = useRef(addressDraft.city);
  useEffect(() => {
    if (addressDraft.city === lastDraftCityRef.current) return;
    lastDraftCityRef.current = addressDraft.city;
    if (addressDraft.citySlug && addressDraft.city !== getValues('city')) {
      setValue('city', addressDraft.city, { shouldValidate: true, shouldDirty: true });
      saveDraftField('city', addressDraft.city);
    }
  }, [addressDraft.city, addressDraft.citySlug, getValues, setValue, saveDraftField]);

  // Si l'utilisateur modifie le champ texte SANS passer par le listbox
  // (frappe libre), on invalide les champs cached pour éviter qu'un prix
  // stale soit affiché alors que le texte ne correspond plus. Seulement quand
  // le TEXTE change : un brouillon modifié de l'extérieur n'est pas une frappe.
  const lastWatchedCityRef = useRef(watchedCity);
  useEffect(() => {
    const typed = watchedCity !== lastWatchedCityRef.current;
    lastWatchedCityRef.current = watchedCity;
    if (!typed || !addressDraft.citySlug) return;
    if (
      typeof watchedCity === 'string' &&
      watchedCity.trim().toLowerCase() !== addressDraft.city.trim().toLowerCase()
    ) {
      mergeAddressDraft({
        citySlug: null,
        cityNameAr: null,
        cityDeliveryPriceMad: null,
        cityDeliveryEta: null,
      });
    }
  }, [watchedCity, addressDraft.citySlug, addressDraft.city, mergeAddressDraft]);

  // Sur /ar, la ville reconnue s'affiche en arabe ; le formulaire garde le nom
  // canonique, celui du serveur et de la logistique.
  const cityDisplayValue =
    language === 'ar' && addressDraft.citySlug && watchedCity === addressDraft.city
      ? (addressDraft.cityNameAr ?? undefined)
      : undefined;

  // `handleSubmit` valide de façon asynchrone : un double tap passerait entre
  // le premier clic et le passage de la mutation en `loading`.
  const submitLockRef = useRef(false);
  const onSubmit = handleSubmit(async (values) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    try {
      await mutation.execute({
        // Si la ville a été commit via le combobox, on envoie le nom FR
        // canonique (déjà persisté dans le draft) ; sinon le texte saisi.
        city: (useWizardStore.getState().addressDraft.city || values.city).trim(),
        addressLine1: values.addressLine1,
        country: 'MA',
        notes: values.notes || undefined,
        shippingMode: 'standard',
      });
    } catch {
      // Erreur déjà capturée par `mutation.error` — affichée plus bas.
    } finally {
      submitLockRef.current = false;
    }
  }, onInvalid);

  const cityErrorType = errors.city?.type;
  const lineErrorType = errors.addressLine1?.type;
  const notesErrorType = errors.notes?.type;
  useEffect(() => {
    if (cityErrorType) trackValidationError('city', String(cityErrorType));
    if (lineErrorType) trackValidationError('addressLine1', String(lineErrorType));
    if (notesErrorType) trackValidationError('notes', String(notesErrorType));
  }, [cityErrorType, lineErrorType, notesErrorType, trackValidationError]);

  const networkBanner = useMemo(() => {
    if (!mutation.error) return null;
    const e = mutation.error;
    if (e.code === 'invalid_input') return t.errors.invalidInput;
    if (e.code === 'stock_insufficient') return t.errors.stockInsufficient;
    if (e.code === 'price_mismatch') return t.errors.priceMismatch;
    if (e.code === 'rate_limited') return t.errors.rateLimited;
    if (e.httpStatus === 0) return t.errors.networkOffline;
    // Les messages du serveur sont en français.
    return (language === 'fr' && e.message) || t.errors.addressGeneric;
  }, [mutation.error, t.errors, language]);

  return {
    form,
    tracking,
    addressDraft,
    watchedCity: typeof watchedCity === 'string' ? watchedCity : '',
    watchedLine1: typeof watchedLine1 === 'string' ? watchedLine1 : '',
    cityDisplayValue,
    onCitySelected,
    onCityMatched,
    onCityBlur,
    onLineBlur,
    onNotesBlur,
    onSubmit,
    submitting,
    networkBanner,
  };
}
