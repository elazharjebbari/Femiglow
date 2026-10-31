'use client';

/**
 * Étape 2 du wizard — émission des événements `address_*`, une logique unique
 * pour la version actuelle et pour la V2.
 *
 * `getSnapshot` est relu au moment de l'abandon : l'écouteur de sortie de page
 * ne doit pas se réabonner à chaque frappe.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AddressPhase } from '@/lib/checkout/address/address-phase';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { useShippingConfig } from '@/lib/checkout/use-shipping-config';
import { readKitAngleFromDocument } from '@/lib/kit/angle';
import {
  ADDRESS_STEP_EVENTS,
  type AddressStepField,
  type Step2Variant,
} from '@/lib/tracking/address-step-events';
import { useTracking } from '@/lib/tracking/use-tracking';

/** Part du bouton qui doit être à l'écran pour le compter comme vu. */
const CTA_VISIBLE_THRESHOLD = 0.6;

export interface AddressStepSnapshot {
  phase: AddressPhase;
  hasCity: boolean;
}

export interface TrackedCity {
  slug?: string | null;
  matched: boolean;
  priceMad?: number | null;
  eta?: string | null;
}

export interface AddressStepTracking {
  variant: Step2Variant;
  trackCityFocus: () => void;
  trackCitySelected: (city: TrackedCity) => void;
  trackLineFocus: () => void;
  trackValidationError: (field: AddressStepField, code: string) => void;
  trackCtaTapIncomplete: (missingField: AddressStepField) => void;
  trackNoteOpened: () => void;
  /** À poser sur le bouton de confirmation (`address_cta_visible`). */
  ctaRef: (node: HTMLElement | null) => void;
}

export function useAddressStepTracking(
  getSnapshot: () => AddressStepSnapshot,
): AddressStepTracking {
  const { emit, flush, isReady } = useTracking();
  const variant = useWizardStore((s) => s.formContext?.step2Variant ?? 'control');
  const { freeShipping } = useShippingConfig();

  const snapshotRef = useRef(getSnapshot);
  snapshotRef.current = getSnapshot;

  const viewedAtRef = useRef<number | null>(null);
  const sentRef = useRef(new Set<string>());
  // Un seul envoi par clé tant que l'étape reste montée.
  const once = useCallback((key: string): boolean => {
    if (sentRef.current.has(key)) return false;
    sentRef.current.add(key);
    return true;
  }, []);

  const emitStepEvent = useCallback(
    (event: string, params: Record<string, unknown> = {}) => {
      emit(event, { step2_variant: variant, ...params });
    },
    [emit, variant],
  );

  const msSinceView = useCallback(
    () => (viewedAtRef.current === null ? 0 : Math.round(performance.now() - viewedAtRef.current)),
    [],
  );

  const trackCitySelected = useCallback(
    ({ slug, matched, priceMad, eta }: TrackedCity) => {
      if (!once(`city:${slug ?? 'free'}`)) return;
      emitStepEvent(ADDRESS_STEP_EVENTS.citySelected, {
        matched,
        ...(slug ? { city_slug: slug } : {}),
        // Le montant réellement demandé à la cliente, pas le tarif catalogue.
        ...(typeof priceMad === 'number'
          ? { delivery_price_mad: freeShipping ? 0 : priceMad }
          : {}),
        ...(eta ? { eta } : {}),
      });
    },
    [emitStepEvent, freeShipping, once],
  );

  // Vue : attend le consentement, sinon `/api/track` écarterait l'événement.
  useEffect(() => {
    if (!isReady || !once('view')) return;
    viewedAtRef.current = performance.now();
    const angle = readKitAngleFromDocument();
    emitStepEvent(ADDRESS_STEP_EVENTS.view, {
      viewport_h: Math.round(window.innerHeight),
      ...(angle ? { kit_angle: angle } : {}),
    });
    // Reprise d'un brouillon : la ville et ses frais sont déjà à l'écran.
    const { citySlug, cityDeliveryPriceMad, cityDeliveryEta } =
      useWizardStore.getState().addressDraft;
    if (citySlug) {
      trackCitySelected({
        slug: citySlug,
        matched: true,
        priceMad: cityDeliveryPriceMad,
        eta: cityDeliveryEta,
      });
    }
  }, [isReady, once, emitStepEvent, trackCitySelected]);

  // Abandon : `visibilitychange` en plus de `pagehide`, que les navigateurs
  // intégrés (Instagram, Facebook) ne déclenchent pas toujours. L'envoi est
  // forcé : le provider a déjà vidé sa file quand cet écouteur passe.
  useEffect(() => {
    const onLeave = () => {
      if (!once('abandon')) return;
      const { phase, hasCity } = snapshotRef.current();
      emitStepEvent(ADDRESS_STEP_EVENTS.abandon, {
        phase,
        has_city: hasCity,
        ms_on_step: msSinceView(),
      });
      flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onLeave();
    };
    window.addEventListener('pagehide', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [emitStepEvent, flush, msSinceView, once]);

  // Le nœud passe par un état : l'observation suit son cycle de vie, y compris
  // le double montage du mode strict.
  const [ctaNode, setCtaNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!ctaNode || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        if (once('cta_visible')) {
          emitStepEvent(ADDRESS_STEP_EVENTS.ctaVisible, { ms_since_view: msSinceView() });
        }
      },
      { threshold: CTA_VISIBLE_THRESHOLD },
    );
    observer.observe(ctaNode);
    return () => observer.disconnect();
  }, [ctaNode, emitStepEvent, msSinceView, once]);

  const trackCityFocus = useCallback(() => {
    if (once('city_focus')) emitStepEvent(ADDRESS_STEP_EVENTS.cityFocus);
  }, [emitStepEvent, once]);

  const trackLineFocus = useCallback(() => {
    if (once('line_focus')) emitStepEvent(ADDRESS_STEP_EVENTS.lineFocus);
  }, [emitStepEvent, once]);

  const trackValidationError = useCallback(
    (field: AddressStepField, code: string) => {
      if (once(`error:${field}:${code}`)) {
        emitStepEvent(ADDRESS_STEP_EVENTS.validationError, { field, code });
      }
    },
    [emitStepEvent, once],
  );

  const trackCtaTapIncomplete = useCallback(
    (missingField: AddressStepField) => {
      emitStepEvent(ADDRESS_STEP_EVENTS.ctaTapIncomplete, { missing_field: missingField });
    },
    [emitStepEvent],
  );

  const trackNoteOpened = useCallback(() => {
    if (once('note_opened')) emitStepEvent(ADDRESS_STEP_EVENTS.noteOpened);
  }, [emitStepEvent, once]);

  return {
    variant,
    trackCityFocus,
    trackCitySelected,
    trackLineFocus,
    trackValidationError,
    trackCtaTapIncomplete,
    trackNoteOpened,
    ctaRef: setCtaNode,
  };
}
