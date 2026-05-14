/**
 * CHA-231 — Dictionnaire de traductions du wizard checkout.
 *
 * Conception
 * ──────────
 * - **Type-safe** : la clé `WizardDictionary` est l'unique source de vérité.
 *   Chaque locale doit implémenter la même forme — TypeScript échoue à la
 *   compilation si une clé manque.
 * - **Plat sectionné** : chaque section regroupe les copies d'un step ou d'une
 *   préoccupation (errors, common). Évite le sur-imbrication.
 * - **Interpolation simple** : les valeurs sont des `string` ou des fonctions
 *   `(params) => string` quand on a besoin d'injection (ex : { count }).
 * - **Pas de pluriels complexes** : si besoin, on bascule sur `Intl.PluralRules`
 *   plus tard. Pour CHA-231, le wording évite les cas tordus.
 *
 * Convention
 * ──────────
 * - Toutes les chaînes FR par défaut suivent la voix FemiGlow (sobre, posée).
 * - Les chaînes AR sont la traduction culturellement adaptée — pas une calque
 *   FR.
 */

import type { Language } from '@/lib/checkout/schemas/common';

import { dictionaryFr } from './locales/fr';
import { dictionaryAr } from './locales/ar';

// ─────────────────────────────────────────────────────────────────────────────
// Type du dictionnaire — source de vérité
// ─────────────────────────────────────────────────────────────────────────────

export interface WizardDictionary {
  common: {
    back: string;
    continue: string;
    cancel: string;
    retry: string;
    processing: string;
    submit: string;
    optional: string;
  };
  lead: {
    title: string;
    subtitle: string;
    firstNameLabel: string;
    firstNamePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    consentLabel: string;
    consentLink: string;
    ctaSubmit: string;
  };
  address: {
    title: string;
    subtitle: string;
    cityLabel: string;
    cityPlaceholder: string;
    cityHintBilingual: string;
    cityHintMatched: (matched: string) => string;
    addressLine1Label: string;
    addressLine1Placeholder: string;
    notesLabel: string;
    notesPlaceholder: string;
    shippingTitle: string;
    shippingFreeBody: string;
    /** CHA-230 — Bloc dynamique : livraison gratuite (prix=0) + ETA. */
    shippingDynamicFreeBody: (eta: string) => string;
    /** CHA-230 — Bloc dynamique : livraison payante + prix + ETA. */
    shippingDynamicPaidBody: (price: number, eta: string) => string;
    ctaSubmit: string;
    processingOrder: string;
  };
  thankYou: {
    title: string;
    subtitle: string;
    orderRefLabel: string;
    emailConfirmationTitle: string;
    emailConfirmationSubtitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    consentLabel: string;
    ctaSubmit: string;
    success: (email: string) => string;
    newOrderHint: string;
    ctaNewOrder: string;
  };
  errors: {
    invalidInput: string;
    stockInsufficient: string;
    priceMismatch: string;
    rateLimited: string;
    networkOffline: string;
    addressGeneric: string;
    orderGeneric: string;
    emailGeneric: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

const DICTIONARIES: Record<Language, WizardDictionary> = {
  fr: dictionaryFr,
  ar: dictionaryAr,
};

/** Récupère le dictionnaire complet pour une langue donnée. */
export function getWizardDictionary(language: Language): WizardDictionary {
  return DICTIONARIES[language] ?? DICTIONARIES.fr;
}
