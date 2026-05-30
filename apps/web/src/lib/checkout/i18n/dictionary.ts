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
import { dictionaryEn } from './locales/en';

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
  /** CHA-232 — Indicateur de progression du wizard. */
  stepIndicator: {
    navAriaLabel: string;
    labelCartReview: string;
    labelLead: string;
    labelAddress: string;
    labelPayment: string;
    labelThankYou: string;
  };
  /** CHA-232 — Microcopies du shell (durées, badges transverses). */
  shell: {
    /** Réassurance durée totale ("≈ 90 secondes pour confirmer"). */
    timeEstimateTotal: string;
    /** Durée step lead (unité latine conservée). */
    timeEstimateLead: string;
    /** Durée step address. */
    timeEstimateAddress: string;
    /** Durée step thank-you. */
    timeEstimateThankYou: string;
    /** Fallback étape indisponible. */
    stepUnavailable: (name: string) => string;
    /** Fallback hydratation. */
    hydrating: string;
  };
  /** CHA-232 — Step 1 (lead) — copies hardcodées migrées. */
  leadStep: {
    heading: string;
    subtitle: string;
    firstNameLabel: string;
    firstNamePlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    /** Hint masque téléphone (digits/format restent latins). */
    phoneHint: string;
    ctaDefault: string;
    consentLabel: string;
    consentFootnotePrefix: string;
    consentFootnoteLink: string;
    honeypotLabel: string;
    errorRateLimited: string;
    errorNetwork: string;
    errorGeneric: string;
    errorInvalidField: string;
  };
  /** CHA-232 — Bandeau de reprise ("Bon retour, …"). */
  resumeBanner: {
    /** Template avec `{firstName}`. */
    template: string;
    dismissAriaLabel: string;
  };
  /** CHA-232 — Badge "Aucun paiement maintenant". */
  noCommitment: {
    label: string;
    sub: string;
    ariaLabel: string;
  };
  /** CHA-232 — Récap panier permanent. */
  cartRecap: {
    ariaLabel: string;
    /** Préfixe quantité + nom pack ("× Pack FemiGlow"). */
    packLabel: (quantity: number) => string;
    shippingIncluded: string;
    /** Libellé devise affiché (MAD en fr/en, درهم en ar). Phase 9. */
    currency: string;
  };
  /** CHA-232 — Vignette pack mobile (alt par défaut). */
  packThumb: {
    alt: string;
  };
  /** CHA-232 — Step 0 (revue panier, mode B). */
  cartReview: {
    heading: string;
    subtitle: string;
    ctaContinue: string;
  };
  /** CHA-232 — Réassurance livraison offerte (srNote). */
  shipping: {
    freeBadgeSrNote: (price: number) => string;
  };
  /** CHA-232 — StockIndicator (statuts + opt-in retour). */
  stock: {
    inStock: string;
    /** Préfixe en gras ("Il n'en reste que N"). */
    lowStock: (count: number) => string;
    /** Suffixe non gras du message low-stock. */
    lowStockSuffix: string;
    outOfStockTitle: string;
    outOfStockBody: string;
    notifyFormAriaLabel: string;
    notifyEmailLabel: string;
    notifyEmailPlaceholder: string;
    notifyConsentLabel: string;
    notifySubmit: string;
    notifySuccess: string;
    notifyErrorDefault: string;
    notifyErrorUnexpected: string;
    unavailable: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CHA-232 — Langues d'AFFICHAGE du wizard. Sur-ensemble additif et sûr de
 * `Language` (le schéma persisté `languageSchema` reste `'fr' | 'ar'` pour ne
 * pas impacter la validation serveur ni les CHECK SQL). L'anglais existe au
 * niveau du dictionnaire d'affichage uniquement ; tant que le store/route ne
 * propage pas `'en'`, il reste résolu via le mapping caller (en → 'fr').
 */
export type DictionaryLanguage = Language | 'en';

const DICTIONARIES: Record<DictionaryLanguage, WizardDictionary> = {
  fr: dictionaryFr,
  ar: dictionaryAr,
  en: dictionaryEn,
};

/** Récupère le dictionnaire complet pour une langue donnée. */
export function getWizardDictionary(
  language: DictionaryLanguage,
): WizardDictionary {
  return DICTIONARIES[language] ?? DICTIONARIES.fr;
}
