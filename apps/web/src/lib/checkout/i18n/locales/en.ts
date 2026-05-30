/**
 * CHA-232 — English dictionary for the checkout wizard.
 *
 * Display-only locale (additive — see `DictionaryLanguage` in `dictionary.ts`).
 * Same FemiGlow voice: calm, measured, no false urgency, no superlatives.
 * Units (`g`, `ml`, `min`, `s`, `%`) and phone-format digits stay Latin.
 */

import type { WizardDictionary } from '../dictionary';

export const dictionaryEn: WizardDictionary = {
  common: {
    back: 'Back',
    continue: 'Continue',
    cancel: 'Cancel',
    retry: 'Try again',
    processing: 'One moment…',
    submit: 'Send',
    optional: 'optional',
  },
  lead: {
    title: 'Order the ritual',
    subtitle: 'Leave us your first name and a phone number for delivery.',
    firstNameLabel: 'First name',
    firstNamePlaceholder: 'Your first name',
    phoneLabel: 'Phone',
    phonePlaceholder: '+212 6 12 34 56 78',
    consentLabel: 'I agree to be contacted to finalise my order.',
    consentLink: 'Privacy policy',
    ctaSubmit: 'Continue',
  },
  address: {
    title: 'Delivery address',
    subtitle: 'Where should we ship the ritual?',
    cityLabel: 'City',
    cityPlaceholder: 'Rabat, Casablanca, Marrakech…',
    cityHintBilingual:
      'You can type in French or in Arabic (الدار البيضاء).',
    cityHintMatched: (matched) => `Recognised: ${matched}.`,
    addressLine1Label: 'Address',
    addressLine1Placeholder: 'Street number and name',
    notesLabel: 'Note for the courier (optional)',
    notesPlaceholder: 'Intercom code, preferred time slot, instructions…',
    shippingTitle: 'Delivery method',
    shippingFreeBody: 'Free delivery in 24-48 h everywhere in Morocco.',
    shippingDynamicFreeBody: (eta) =>
      `Free delivery in ${eta} — pay on delivery.`,
    shippingDynamicPaidBody: (price, eta) =>
      `Delivery ${price} MAD in ${eta} — pay on delivery.`,
    ctaSubmit: 'Confirm the order',
    processingOrder: 'We are saving your order…',
  },
  thankYou: {
    title: 'Order received, we will call you back.',
    subtitle:
      'We will contact you within 24 h to confirm delivery. Payment is made on delivery, at no extra cost.',
    orderRefLabel: 'Your order reference',
    emailConfirmationTitle: 'Receive the confirmation by email (optional)',
    emailConfirmationSubtitle:
      'Enter your email to receive a written confirmation of your order, plus the tracking number when it ships.',
    emailLabel: 'Your email',
    emailPlaceholder: 'you@example.ma',
    consentLabel:
      'I agree to receive the confirmation and notifications related to this order.',
    ctaSubmit: 'Send the confirmation',
    success: (email) => `Confirmation sent to ${email}.`,
    newOrderHint: 'Another order to place?',
    ctaNewOrder: 'Start a new order',
  },
  errors: {
    invalidInput: 'A field was not accepted. Please check your details.',
    stockInsufficient:
      'Not enough stock for this order. Try again or reduce the quantity.',
    priceMismatch:
      'Prices have changed since you arrived. Refresh the page to review the summary.',
    rateLimited: 'Too many attempts. Try again in a moment.',
    networkOffline:
      'No network connection. Check your network, then try again.',
    addressGeneric:
      'One moment — the address could not be saved. Try again.',
    orderGeneric: 'One moment — the order could not be finalised.',
    emailGeneric: 'The sign-up could not be saved. Try again.',
  },
  stepIndicator: {
    navAriaLabel: 'Wizard progress',
    labelCartReview: 'Cart',
    labelLead: 'Your details',
    labelAddress: 'Delivery',
    labelPayment: 'Payment',
    labelThankYou: 'Confirmation',
  },
  shell: {
    timeEstimateTotal: '≈ 90 s to confirm',
    timeEstimateLead: '60 s',
    timeEstimateAddress: '30 s',
    timeEstimateThankYou: '5 s',
    stepUnavailable: (name) => `The “${name}” step is not available yet.`,
    hydrating: 'One moment…',
  },
  leadStep: {
    heading: 'Your details',
    subtitle: 'Two details only — we will call you back to confirm.',
    firstNameLabel: 'Your first name',
    firstNamePlaceholder: 'Yasmine',
    phoneLabel: 'Phone',
    phonePlaceholder: '06 12 34 56 78',
    phoneHint: 'Moroccan mobile number. Format +212 6 XX XX XX XX.',
    ctaDefault: 'Continue',
    consentLabel: 'I want to be called back to confirm my order.',
    consentFootnotePrefix: 'No resale, no spam —',
    consentFootnoteLink: 'legal notice',
    honeypotLabel: 'Website (do not fill in)',
    errorRateLimited: 'Too many submissions. Try again in a few moments.',
    errorNetwork:
      'No network connection. Check your network, then try again.',
    errorGeneric: 'One moment — the order could not start. Try again.',
    errorInvalidField: 'A field was not accepted. Please check your details.',
  },
  resumeBanner: {
    template: 'Welcome back, {firstName} — we pick up where you left off.',
    dismissAriaLabel: 'Close the welcome banner',
  },
  noCommitment: {
    label: 'No payment now',
    sub: 'You pay on delivery, in hand',
    ariaLabel: 'No-commitment guarantee',
  },
  cartRecap: {
    ariaLabel: 'Summary of your order',
    packLabel: (quantity) => `${quantity} × FemiGlow Pack`,
    shippingIncluded: 'delivery included',
    currency: 'MAD',
  },
  packThumb: {
    alt: 'FemiGlow Pack',
  },
  cartReview: {
    heading: 'Your cart',
    subtitle:
      'Review step available in mode B (`/commander`). Full implementation in Phase 9.',
    ctaContinue: 'Your details',
  },
  shipping: {
    freeBadgeSrNote: (price) =>
      `Delivery normally ${price} MAD, currently free`,
  },
  stock: {
    inStock: 'In stock — shipped within 24-48h',
    lowStock: (count) => `Only ${count} left`,
    lowStockSuffix: ' — consider ordering before it runs out.',
    outOfStockTitle: 'Temporarily out of stock',
    outOfStockBody:
      'The ritual is being restocked. Leave us your email — you will be notified as soon as it is back.',
    notifyFormAriaLabel: 'Notify me when back in stock',
    notifyEmailLabel: 'Your email',
    notifyEmailPlaceholder: 'you@example.ma',
    notifyConsentLabel:
      'I agree to be notified when it is back in stock. No other use of this email.',
    notifySubmit: 'Notify me',
    notifySuccess: 'Signed up. We will write to you as soon as the ritual is back.',
    notifyErrorDefault: 'Sign-up failed. Try again later.',
    notifyErrorUnexpected: 'Unexpected error.',
    unavailable: 'Stock unavailable.',
  },
};
