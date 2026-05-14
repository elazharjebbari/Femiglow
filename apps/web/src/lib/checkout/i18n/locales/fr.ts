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
};
