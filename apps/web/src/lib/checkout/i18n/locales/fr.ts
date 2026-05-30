/**
 * CHA-231 — Dictionnaire FR du wizard checkout.
 *
 * Voix FemiGlow : sobre, posée, sans pression. Pas d'urgence factice, pas
 * de superlatifs. On guide, on rassure, on respecte.
 */

import type { WizardDictionary } from '../dictionary';

export const dictionaryFr: WizardDictionary = {
  common: {
    back: 'Retour',
    continue: 'Continuer',
    cancel: 'Annuler',
    retry: 'Réessayer',
    processing: 'Un instant…',
    submit: 'Envoyer',
    optional: 'optionnel',
  },
  lead: {
    title: 'Commander le rituel',
    subtitle: 'Laissez-nous votre prénom et un numéro pour la livraison.',
    firstNameLabel: 'Prénom',
    firstNamePlaceholder: 'Votre prénom',
    phoneLabel: 'Téléphone',
    phonePlaceholder: '+212 6 12 34 56 78',
    consentLabel:
      "J'accepte d'être recontactée pour finaliser ma commande.",
    consentLink: 'Politique de confidentialité',
    ctaSubmit: 'Continuer',
  },
  address: {
    title: 'Adresse de livraison',
    subtitle: 'Où vous expédier le rituel ?',
    cityLabel: 'Ville',
    cityPlaceholder: 'Rabat, Casablanca, Marrakech…',
    cityHintBilingual:
      'Vous pouvez taper en français ou en arabe (الدار البيضاء).',
    cityHintMatched: (matched) => `Reconnu : ${matched}.`,
    addressLine1Label: 'Adresse',
    addressLine1Placeholder: 'N° et nom de rue',
    notesLabel: 'Note pour le livreur (optionnel)',
    notesPlaceholder: 'Code interphone, créneau préféré, instructions…',
    shippingTitle: 'Mode de livraison',
    shippingFreeBody: 'Livraison gratuite en 24-48 h partout au Maroc.',
    shippingDynamicFreeBody: (eta) =>
      `Livraison gratuite en ${eta} — paiement à la livraison.`,
    shippingDynamicPaidBody: (price, eta) =>
      `Livraison ${price} MAD en ${eta} — paiement à la livraison.`,
    ctaSubmit: 'Confirmer la commande',
    processingOrder: 'Nous enregistrons votre commande…',
  },
  thankYou: {
    title: 'Commande reçue, on vous rappelle.',
    subtitle:
      'Nous vous contactons sous 24 h pour confirmer la livraison. Le paiement se fait à la livraison, sans frais.',
    orderRefLabel: 'Référence de votre commande',
    emailConfirmationTitle: 'Recevoir la confirmation par email (optionnel)',
    emailConfirmationSubtitle:
      "Renseignez votre email pour recevoir une confirmation écrite de votre commande, ainsi que le numéro de suivi à l'expédition.",
    emailLabel: 'Votre email',
    emailPlaceholder: 'vous@exemple.ma',
    consentLabel:
      "J'accepte de recevoir la confirmation et les notifications liées à cette commande.",
    ctaSubmit: 'Envoyer la confirmation',
    success: (email) => `Confirmation envoyée à ${email}.`,
    newOrderHint: 'Une autre commande à passer ?',
    ctaNewOrder: 'Commencer une nouvelle commande',
  },
  errors: {
    invalidInput: "Un champ n'a pas été accepté. Vérifiez vos informations.",
    stockInsufficient:
      'Stock insuffisant pour cette commande. Réessayez ou réduisez la quantité.',
    priceMismatch:
      'Les prix ont changé depuis votre arrivée. Rafraîchissez la page pour revoir le récap.',
    rateLimited: "Trop de tentatives. Réessayez dans un instant.",
    networkOffline:
      'Connexion réseau impossible. Vérifiez votre réseau, puis réessayez.',
    addressGeneric:
      "Un instant — l'adresse n'a pas pu être enregistrée. Réessayez.",
    orderGeneric: "Un instant — la commande n'a pas pu être finalisée.",
    emailGeneric:
      "L'inscription n'a pas pu être enregistrée. Réessayez.",
  },
  stepIndicator: {
    navAriaLabel: 'Progression du wizard',
    labelCartReview: 'Panier',
    labelLead: 'Vos coordonnées',
    labelAddress: 'Livraison',
    labelPayment: 'Paiement',
    labelThankYou: 'Confirmation',
  },
  shell: {
    timeEstimateTotal: '≈ 90 secondes pour confirmer',
    timeEstimateLead: '60 s',
    timeEstimateAddress: '30 s',
    timeEstimateThankYou: '5 s',
    stepUnavailable: (name) =>
      `L'étape « ${name} » n'est pas encore disponible.`,
    hydrating: 'Un instant…',
  },
  leadStep: {
    heading: 'Vos coordonnées',
    subtitle: 'Deux informations seulement — nous vous rappelons pour confirmer.',
    firstNameLabel: 'Votre prénom',
    firstNamePlaceholder: 'Yasmine',
    phoneLabel: 'Téléphone',
    phonePlaceholder: '06 12 34 56 78',
    phoneHint: 'Numéro mobile Maroc. Format +212 6 XX XX XX XX.',
    ctaDefault: 'Continuer',
    consentLabel: 'Je veux être rappelée pour confirmer ma commande.',
    consentFootnotePrefix: 'Pas de revente, pas de spam —',
    consentFootnoteLink: 'mentions légales',
    honeypotLabel: 'Site web (ne pas remplir)',
    errorRateLimited: 'Trop d’envois. Réessayez dans quelques instants.',
    errorNetwork:
      'Connexion réseau impossible. Vérifiez votre réseau, puis réessayez.',
    errorGeneric: 'Un instant — la commande n’a pas pu démarrer. Réessayez.',
    errorInvalidField:
      'Un champ n’a pas été accepté. Vérifiez vos informations.',
  },
  resumeBanner: {
    template: 'Bon retour, {firstName} — on reprend où vous en étiez.',
    dismissAriaLabel: 'Fermer la bannière de bienvenue',
  },
  noCommitment: {
    label: 'Aucun paiement maintenant',
    sub: 'Vous payez à la livraison, en main',
    ariaLabel: 'Garantie sans engagement',
  },
  cartRecap: {
    ariaLabel: 'Récapitulatif de votre commande',
    packLabel: (quantity) => `${quantity} × Pack FemiGlow`,
    shippingIncluded: 'livraison incluse',
    currency: 'MAD',
  },
  packThumb: {
    alt: 'Pack FemiGlow',
  },
  cartReview: {
    heading: 'Votre panier',
    subtitle:
      'Étape de revue disponible en mode B (`/commander`). Implémentation complète en Phase 9.',
    ctaContinue: 'Vos coordonnées',
  },
  shipping: {
    freeBadgeSrNote: (price) =>
      `Livraison normalement à ${price} MAD, actuellement offerte`,
  },
  stock: {
    inStock: 'En stock — expédié sous 24-48h',
    lowStock: (count) => `Il n’en reste que ${count}`,
    lowStockSuffix: ' — pensez à commander avant épuisement.',
    outOfStockTitle: 'Rupture momentanée',
    outOfStockBody:
      'Le rituel est en réassort. Laissez-nous votre email — vous serez prévenue dès qu’il revient.',
    notifyFormAriaLabel: "M'avertir du retour en stock",
    notifyEmailLabel: 'Votre email',
    notifyEmailPlaceholder: 'vous@exemple.ma',
    notifyConsentLabel:
      'J’accepte d’être prévenue du retour en stock. Aucun autre usage de cet email.',
    notifySubmit: 'Me prévenir',
    notifySuccess: 'Inscrite. Nous vous écrivons dès le retour du rituel.',
    notifyErrorDefault: 'Inscription impossible. Réessayez plus tard.',
    notifyErrorUnexpected: 'Erreur inattendue.',
    unavailable: 'Stock indisponible.',
  },
};
