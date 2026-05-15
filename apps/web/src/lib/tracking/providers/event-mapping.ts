import type { TrackingProviderKind } from '@/lib/db/types';

/**
 * Mapping FemiGlow event → noms canoniques par provider.
 *
 * Source unique de vérité consommée à la fois par :
 *  - le runtime (Meta CAPI, dispatchers serveur, GTM dataLayer client)
 *  - l'exporter GTM admin (génération des tags + variables)
 *
 * En plus du renommage, le mapping porte deux signaux structurants :
 *  - `google_ads.conversionLabelKey` : si présent, l'event est une
 *    *conversion Google Ads*. La valeur est la clé (logique) du label
 *    Google Ads stocké dans `envConfig.googleAdsConversionLabels[<key>]`
 *    (ex. "checkout_intent" → "UGxLCMGJv6wcEMrHichD").
 *  - `identityFields` : liste des champs identity à hydrater dans
 *    `dataLayer.user_data` au moment de l'emit. Le client se charge de
 *    hasher (SHA-256) côté navigateur avant push — Enhanced Conversions
 *    (Google Ads) et Advanced Matching (Meta pixel) s'en servent.
 */

export type IdentityField =
  | 'email'
  | 'phone'
  | 'firstName'
  | 'lastName'
  | 'city'
  | 'country';

export interface ProviderEventEntry {
  name: string;
  /** True pour les events « standard » du provider (ex. Meta `Purchase`,
   *  `InitiateCheckout`). Sinon = custom event. Informatif. */
  isStandard?: boolean;
}

export interface AdsEventEntry extends ProviderEventEntry {
  /** Si défini, cet event est une conversion Google Ads.
   *  La valeur est lookupable dans envConfig.googleAdsConversionLabels. */
  conversionLabelKey?: string;
}

export interface EventMapping {
  meta?: ProviderEventEntry;
  google_ga4?: ProviderEventEntry;
  google_ads?: AdsEventEntry;
  tiktok?: ProviderEventEntry;
  snap?: ProviderEventEntry;
  pinterest?: ProviderEventEntry;
  identityFields?: IdentityField[];
}

const MAP: Record<string, EventMapping> = {
  page_view: {
    meta: { name: 'PageView', isStandard: true },
    google_ga4: { name: 'page_view', isStandard: true },
    tiktok: { name: 'Pageview', isStandard: true },
    snap: { name: 'PAGE_VIEW', isStandard: true },
    pinterest: { name: 'pagevisit', isStandard: true },
  },
  view_item: {
    meta: { name: 'ViewContent', isStandard: true },
    google_ga4: { name: 'view_item', isStandard: true },
    tiktok: { name: 'ViewContent', isStandard: true },
    snap: { name: 'VIEW_CONTENT', isStandard: true },
    pinterest: { name: 'pagevisit', isStandard: true },
  },
  view_item_list: {
    meta: { name: 'ViewContent', isStandard: true },
    google_ga4: { name: 'view_item_list', isStandard: true },
  },
  select_item: { google_ga4: { name: 'select_item', isStandard: true } },
  add_to_cart: {
    meta: { name: 'AddToCart', isStandard: true },
    google_ga4: { name: 'add_to_cart', isStandard: true },
    google_ads: { name: 'add_to_cart', conversionLabelKey: 'add_to_cart' },
    tiktok: { name: 'AddToCart', isStandard: true },
    snap: { name: 'ADD_CART', isStandard: true },
    pinterest: { name: 'addtocart', isStandard: true },
  },
  remove_from_cart: { google_ga4: { name: 'remove_from_cart', isStandard: true } },
  view_cart: { google_ga4: { name: 'view_cart', isStandard: true } },

  // — NOUVEAU EVENT canonique « checkout_intent » —
  // Fire dès la 1ère frappe (≥1 char) dans l'étape 1 du formulaire lead.
  // Remplace l'ancien `begin_checkout` (qui fire au submit, sémantique fausse).
  // Mapping : retour aux events standards (InitiateCheckout, begin_checkout)
  // — D-004 caduc puisque le timing est désormais correct (intent réel,
  // pas page view déguisée). Conversion Google Ads obligatoire.
  checkout_intent: {
    meta: { name: 'InitiateCheckout', isStandard: true },
    google_ga4: { name: 'begin_checkout', isStandard: true },
    google_ads: {
      name: 'begin_checkout',
      conversionLabelKey: 'checkout_intent',
    },
    tiktok: { name: 'InitiateCheckout', isStandard: true },
    snap: { name: 'START_CHECKOUT', isStandard: true },
    pinterest: { name: 'checkout', isStandard: true },
    // Pas d'identity au 1er char — valeurs partielles non fiables.
  },

  // Conservé pour rétrocompat des dashboards GA4 — n'est plus émis depuis l'UI.
  // À supprimer après une période de double-run si plus aucune source ne l'émet.
  begin_checkout: {
    meta: { name: 'InitiateCheckout', isStandard: true },
    google_ga4: { name: 'begin_checkout', isStandard: true },
    google_ads: {
      name: 'begin_checkout',
      conversionLabelKey: 'checkout_intent',
    },
    tiktok: { name: 'InitiateCheckout', isStandard: true },
    snap: { name: 'START_CHECKOUT', isStandard: true },
    pinterest: { name: 'checkout', isStandard: true },
  },

  add_shipping_info: {
    google_ga4: { name: 'add_shipping_info', isStandard: true },
    identityFields: ['firstName', 'phone', 'city', 'country'],
  },
  add_payment_info: {
    meta: { name: 'AddPaymentInfo', isStandard: true },
    google_ga4: { name: 'add_payment_info', isStandard: true },
    tiktok: { name: 'AddPaymentInfo', isStandard: true },
    snap: { name: 'ADD_BILLING', isStandard: true },
    identityFields: ['firstName', 'lastName', 'phone', 'city', 'country'],
  },

  // Conversion principale — Enhanced Conversions (Google Ads) + Advanced
  // Matching (Meta) doivent recevoir l'identity hashée.
  purchase: {
    meta: { name: 'Purchase', isStandard: true },
    google_ga4: { name: 'purchase', isStandard: true },
    google_ads: { name: 'purchase', conversionLabelKey: 'purchase' },
    tiktok: { name: 'CompletePayment', isStandard: true },
    snap: { name: 'PURCHASE', isStandard: true },
    pinterest: { name: 'checkout', isStandard: true },
    identityFields: ['email', 'phone', 'firstName', 'lastName', 'city', 'country'],
  },
  refund: { google_ga4: { name: 'refund', isStandard: true } },
  view_promotion: { google_ga4: { name: 'view_promotion', isStandard: true } },
  select_promotion: { google_ga4: { name: 'select_promotion', isStandard: true } },

  generate_lead: {
    meta: { name: 'Lead', isStandard: true },
    google_ga4: { name: 'generate_lead', isStandard: true },
    google_ads: { name: 'generate_lead', conversionLabelKey: 'lead' },
    tiktok: { name: 'SubmitForm', isStandard: true },
    snap: { name: 'SIGN_UP', isStandard: true },
    pinterest: { name: 'lead', isStandard: true },
    identityFields: ['email', 'phone', 'firstName'],
  },
  sign_up: {
    meta: { name: 'CompleteRegistration', isStandard: true },
    google_ga4: { name: 'sign_up', isStandard: true },
    tiktok: { name: 'CompleteRegistration', isStandard: true },
    snap: { name: 'SIGN_UP', isStandard: true },
    pinterest: { name: 'signup', isStandard: true },
    identityFields: ['email'],
  },
  login: { google_ga4: { name: 'login', isStandard: true } },
  search: {
    meta: { name: 'Search', isStandard: true },
    google_ga4: { name: 'search', isStandard: true },
    tiktok: { name: 'Search', isStandard: true },
    pinterest: { name: 'search', isStandard: true },
  },
  share: { google_ga4: { name: 'share', isStandard: true } },
  scroll_depth: { google_ga4: { name: 'scroll', isStandard: true } },
  click: { google_ga4: { name: 'click', isStandard: true } },
  select_content: { google_ga4: { name: 'select_content', isStandard: true } },
  video_start: { google_ga4: { name: 'video_start', isStandard: true } },
  video_progress: { google_ga4: { name: 'video_progress', isStandard: true } },
  video_complete: { google_ga4: { name: 'video_complete', isStandard: true } },
  file_download: { google_ga4: { name: 'file_download', isStandard: true } },
  form_start: { google_ga4: { name: 'form_start', isStandard: true } },
  form_submit: { google_ga4: { name: 'form_submit', isStandard: true } },

  // CHA-230 — conversion lead côté wizard FemiGlow.
  lead_capture: {
    google_ga4: { name: 'lead_capture', isStandard: false },
    meta: { name: 'Lead', isStandard: true },
    google_ads: { name: 'generate_lead', conversionLabelKey: 'lead' },
    identityFields: ['phone', 'firstName'],
  },
  address_completed: {
    google_ga4: { name: 'add_shipping_info', isStandard: true },
    identityFields: ['firstName', 'phone', 'city', 'country'],
  },
  wizard_error: { google_ga4: { name: 'wizard_error', isStandard: false } },
  wizard_abandoned: { google_ga4: { name: 'wizard_abandoned', isStandard: false } },

  fg_journal_read_75: { google_ga4: { name: 'fg_journal_read_75', isStandard: false } },
  fg_journal_read_100: { google_ga4: { name: 'fg_journal_read_100', isStandard: false } },
  fg_section_view: { google_ga4: { name: 'fg_section_view', isStandard: false } },
  fg_faq_view: { google_ga4: { name: 'fg_faq_view', isStandard: false } },
  fg_composition_open: { google_ga4: { name: 'fg_composition_open', isStandard: false } },
  fg_pixel_test: { google_ga4: { name: 'fg_pixel_test', isStandard: false } },
  fg_admin_action: { google_ga4: { name: 'fg_admin_action', isStandard: false } },
  fg_consent_change: { google_ga4: { name: 'fg_consent_change', isStandard: false } },

  chat_widget_open: {
    google_ga4: { name: 'chat_widget_open', isStandard: false },
    meta: { name: 'ChatEngagement', isStandard: false },
  },
  chat_widget_close: { google_ga4: { name: 'chat_widget_close', isStandard: false } },
  chat_message_sent: {
    google_ga4: { name: 'chat_message_sent', isStandard: false },
    meta: { name: 'Contact', isStandard: true },
  },
  chat_message_received: { google_ga4: { name: 'chat_message_received', isStandard: false } },
  chat_message_complete: { google_ga4: { name: 'chat_message_complete', isStandard: false } },
  chat_lead_form_offered: { google_ga4: { name: 'chat_lead_form_offered', isStandard: false } },
  chat_lead_form_view: { google_ga4: { name: 'chat_lead_form_view', isStandard: false } },
  chat_lead_form_focus: { google_ga4: { name: 'chat_lead_form_focus', isStandard: false } },
  chat_lead_form_dismiss: { google_ga4: { name: 'chat_lead_form_dismiss', isStandard: false } },
  chat_lead_form_submit: {
    google_ga4: { name: 'generate_lead', isStandard: true },
    meta: { name: 'Lead', isStandard: true },
    google_ads: { name: 'generate_lead', conversionLabelKey: 'lead' },
    tiktok: { name: 'SubmitForm', isStandard: true },
    snap: { name: 'LEAD', isStandard: true },
    pinterest: { name: 'lead', isStandard: true },
    identityFields: ['email', 'phone'],
  },
  chat_lead_webhook_sent: { google_ga4: { name: 'chat_lead_webhook_sent', isStandard: false } },
  chat_lead_webhook_failed: { google_ga4: { name: 'chat_lead_webhook_failed', isStandard: false } },
  chat_suggestion_clicked: { google_ga4: { name: 'chat_suggestion_clicked', isStandard: false } },
  chat_feedback: { google_ga4: { name: 'chat_feedback', isStandard: false } },
  chat_language_switch: { google_ga4: { name: 'chat_language_switch', isStandard: false } },
  chat_error: { google_ga4: { name: 'chat_error', isStandard: false } },
  chat_rate_limit_hit: { google_ga4: { name: 'chat_rate_limit_hit', isStandard: false } },
  chat_conversion_attributed: {
    google_ga4: { name: 'chat_conversion_attributed', isStandard: false },
  },
};

export function getEventMapping(eventName: string): EventMapping | null {
  return MAP[eventName] ?? null;
}

export function mapEventName(eventName: string, kind: TrackingProviderKind): string | null {
  const entry = MAP[eventName];
  if (!entry) return null;
  switch (kind) {
    case 'meta':
      return entry.meta?.name ?? null;
    case 'google_ga4':
      return entry.google_ga4?.name ?? null;
    case 'google_ads':
      return entry.google_ads?.name ?? entry.google_ga4?.name ?? null;
    case 'tiktok':
      return entry.tiktok?.name ?? null;
    case 'snap':
      return entry.snap?.name ?? null;
    case 'pinterest':
      return entry.pinterest?.name ?? null;
    default:
      return null;
  }
}

export function isEventSupported(eventName: string, kind: TrackingProviderKind): boolean {
  return mapEventName(eventName, kind) !== null;
}

/**
 * Renvoie la clé du label Google Ads pour l'event donné, ou null si
 * l'event n'est pas une conversion Ads. La valeur est ensuite résolue
 * via envConfig.googleAdsConversionLabels[<key>].
 */
export function getAdsConversionLabelKey(eventName: string): string | null {
  return MAP[eventName]?.google_ads?.conversionLabelKey ?? null;
}

/**
 * Liste des champs identity à inclure dans `user_data` du dataLayer
 * pour cet event (Enhanced Conversions + Advanced Matching).
 */
export function getEventIdentityFields(eventName: string): IdentityField[] {
  return MAP[eventName]?.identityFields ?? [];
}

/** Liste des events qui sont des conversions Google Ads (pour l'exporter). */
export function listAdsConversionEvents(): Array<{ eventName: string; conversionLabelKey: string }> {
  const out: Array<{ eventName: string; conversionLabelKey: string }> = [];
  for (const [eventName, entry] of Object.entries(MAP)) {
    const key = entry.google_ads?.conversionLabelKey;
    if (key) out.push({ eventName, conversionLabelKey: key });
  }
  return out;
}
