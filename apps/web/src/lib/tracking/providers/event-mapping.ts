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

/**
 * Catégorie de conversion Google Ads — enum API v18.
 * Source : https://developers.google.com/google-ads/api/reference/rpc/v18/ConversionActionCategoryEnum.ConversionActionCategory
 *
 * NB : `SIGNUP` est sans underscore (gotcha Google).
 */
export type AdsConversionCategory =
  // Sales group
  | 'PURCHASE'
  | 'ADD_TO_CART'
  | 'BEGIN_CHECKOUT'
  | 'SUBSCRIBE_PAID'
  // Leads group
  | 'CONTACT'
  | 'SUBMIT_LEAD_FORM'
  | 'BOOK_APPOINTMENT'
  | 'SIGNUP'
  | 'REQUEST_QUOTE'
  | 'GET_DIRECTIONS'
  // Further actions group
  | 'OUTBOUND_CLICK'
  | 'PAGE_VIEW'
  | 'DEFAULT';

/**
 * Rôle de la conversion pour le bidding Google Ads.
 *  - `primary`   : utilisée pour piloter Smart Bidding (tCPA, ROAS…)
 *  - `secondary` : observation/reporting uniquement, n'influence pas
 *                  l'algo.
 */
export type AdsConversionRole = 'primary' | 'secondary';

/** Groupe UI (mirroir des groupes affichés dans Google Ads UI). */
export type AdsConversionGroup = 'sales' | 'leads' | 'further';

export interface AdsEventEntry extends ProviderEventEntry {
  /** Si défini, cet event est une conversion Google Ads. La valeur est
   *  lookupable dans envConfig.googleAdsConversionLabels[<key>]. */
  conversionLabelKey?: string;
  /** Catégorie API recommandée (paramètre `conversionCategory` du tag GTM). */
  category?: AdsConversionCategory;
  /** Rôle recommandé pour le bidding (info UI seulement). */
  recommendedRole?: AdsConversionRole;
  /** Groupe d'affichage UI. Dérivable de `category`, mais explicite pour
   *  garder le mapping data-driven. */
  group?: AdsConversionGroup;
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
    google_ads: {
      name: 'add_to_cart',
      conversionLabelKey: 'add_to_cart',
      category: 'ADD_TO_CART',
      recommendedRole: 'secondary',
      group: 'sales',
    },
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
      category: 'BEGIN_CHECKOUT',
      recommendedRole: 'secondary',
      group: 'sales',
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
      category: 'BEGIN_CHECKOUT',
      recommendedRole: 'secondary',
      group: 'sales',
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
    google_ads: {
      name: 'purchase',
      conversionLabelKey: 'purchase',
      category: 'PURCHASE',
      recommendedRole: 'primary',
      group: 'sales',
    },
    // TikTok canonical event name (unified across Pixel + Events API V2).
    // The legacy `CompletePayment` from Events API V1.3 is deprecated and
    // no longer optimizes Sales campaigns since the unification.
    // Source: ads.tiktok.com/help/article/standard-events-parameters
    tiktok: { name: 'Purchase', isStandard: true },
    snap: { name: 'PURCHASE', isStandard: true },
    pinterest: { name: 'checkout', isStandard: true },
    identityFields: ['email', 'phone', 'firstName', 'lastName', 'city', 'country'],
  },
  // Variant CAPI-only de purchase : émis depuis le webhook Stripe
  // (cf. apps/web/src/app/api/stripe/webhook/route.ts) avec value/currency
  // venant directement de Stripe. Doit être reporté en `Purchase` canonique
  // côté Meta/TikTok/Snap pour ne pas se faire compter comme custom event.
  // cf. docs/meta-quality-audit-2026-05/02-plan-dev-action.md step 1.3
  purchase_server: {
    meta: { name: 'Purchase', isStandard: true },
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
    google_ads: {
      name: 'generate_lead',
      conversionLabelKey: 'lead',
      category: 'SUBMIT_LEAD_FORM',
      recommendedRole: 'primary',
      group: 'leads',
    },
    tiktok: { name: 'SubmitForm', isStandard: true },
    snap: { name: 'LEAD', isStandard: true },
    pinterest: { name: 'lead', isStandard: true },
    identityFields: ['email', 'phone', 'firstName'],
  },
  sign_up: {
    meta: { name: 'CompleteRegistration', isStandard: true },
    google_ga4: { name: 'sign_up', isStandard: true },
    google_ads: {
      // NB : enum `SIGNUP` sans underscore, et `name` reste GA4-style.
      // Marqué secondary pour cohérence avec la config Google Ads UI
      // (Secondaire dans le groupe "Envoi de formulaire de lead").
      // Conséquence côté gating : broadcast sur tous les canaux pour
      // alimenter smart bidding sans skewer l'attribution primary.
      name: 'sign_up',
      conversionLabelKey: 'sign_up',
      category: 'SIGNUP',
      recommendedRole: 'secondary',
      group: 'leads',
    },
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
  video_complete: {
    google_ga4: { name: 'video_complete', isStandard: true },
    google_ads: {
      name: 'video_complete',
      conversionLabelKey: 'video_complete',
      category: 'DEFAULT',
      recommendedRole: 'secondary',
      group: 'further',
    },
  },
  file_download: {
    google_ga4: { name: 'file_download', isStandard: true },
    google_ads: {
      name: 'file_download',
      conversionLabelKey: 'download',
      category: 'DEFAULT',
      recommendedRole: 'secondary',
      group: 'further',
    },
  },
  form_start: { google_ga4: { name: 'form_start', isStandard: true } },
  form_submit: { google_ga4: { name: 'form_submit', isStandard: true } },
  // ── Leads complémentaires (formulaires + chat + newsletter) ──
  contact_submit: {
    google_ga4: { name: 'contact_submit', isStandard: false },
    google_ads: {
      name: 'contact_submit',
      conversionLabelKey: 'contact',
      category: 'CONTACT',
      recommendedRole: 'primary',
      group: 'leads',
    },
    identityFields: ['email'],
  },
  newsletter_submit: {
    google_ga4: { name: 'newsletter_submit', isStandard: false },
    google_ads: {
      // Catégorie SIGNUP (inscription = subscribe gratuit) — secondaire
      // car volume élevé et intent plus faible que lead_capture.
      name: 'newsletter_submit',
      conversionLabelKey: 'newsletter',
      category: 'SIGNUP',
      recommendedRole: 'secondary',
      group: 'leads',
    },
    identityFields: ['email'],
  },

  // CHA-230 — conversion lead côté wizard FemiGlow.
  lead_capture: {
    google_ga4: { name: 'lead_capture', isStandard: false },
    meta: { name: 'Lead', isStandard: true },
    google_ads: {
      name: 'generate_lead',
      conversionLabelKey: 'lead',
      category: 'SUBMIT_LEAD_FORM',
      recommendedRole: 'primary',
      group: 'leads',
    },
    snap: { name: 'LEAD', isStandard: true },
    identityFields: ['phone', 'firstName'],
  },
  address_completed: {
    google_ga4: { name: 'add_shipping_info', isStandard: true },
    identityFields: ['firstName', 'phone', 'city', 'country'],
  },
  wizard_error: { google_ga4: { name: 'wizard_error', isStandard: false } },
  wizard_abandoned: { google_ga4: { name: 'wizard_abandoned', isStandard: false } },

  fg_journal_read_75: { google_ga4: { name: 'fg_journal_read_75', isStandard: false } },
  fg_journal_read_100: {
    google_ga4: { name: 'fg_journal_read_100', isStandard: false },
    google_ads: {
      // Lecture journal à 100% = signal d'engagement éditorial fort.
      // Catégorie DEFAULT (UI "Other") — observation seulement.
      name: 'fg_journal_read_100',
      conversionLabelKey: 'journal_read',
      category: 'DEFAULT',
      recommendedRole: 'secondary',
      group: 'further',
    },
  },
  fg_section_view: { google_ga4: { name: 'fg_section_view', isStandard: false } },
  fg_faq_view: { google_ga4: { name: 'fg_faq_view', isStandard: false } },
  fg_composition_open: { google_ga4: { name: 'fg_composition_open', isStandard: false } },
  fg_pixel_test: { google_ga4: { name: 'fg_pixel_test', isStandard: false } },
  fg_admin_action: { google_ga4: { name: 'fg_admin_action', isStandard: false } },
  fg_consent_change: { google_ga4: { name: 'fg_consent_change', isStandard: false } },

  chat_widget_open: {
    google_ga4: { name: 'chat_widget_open', isStandard: false },
    meta: { name: 'ChatEngagement', isStandard: false },
    google_ads: {
      // 1ère ouverture chat = signal d'intent. Observation seulement
      // (volume très élevé sinon).
      name: 'chat_widget_open',
      conversionLabelKey: 'chat_engagement',
      category: 'DEFAULT',
      recommendedRole: 'secondary',
      group: 'further',
    },
  },
  chat_widget_close: { google_ga4: { name: 'chat_widget_close', isStandard: false } },
  chat_message_sent: {
    google_ga4: { name: 'chat_message_sent', isStandard: false },
    meta: { name: 'Contact', isStandard: true },
    google_ads: {
      // 1er message utilisateur = vrai signal de Contact côté Ads.
      // Marqué primary pour cohérence avec la config Google Ads UI
      // (groupe "Envoi de formulaire de lead", role Principale).
      // Note : doit être gated « 1re fois par session » côté GTM si
      // beaucoup de messages par conversation.
      name: 'chat_message_sent',
      conversionLabelKey: 'chat_contact',
      category: 'CONTACT',
      recommendedRole: 'primary',
      group: 'leads',
    },
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
    google_ads: {
      name: 'generate_lead',
      conversionLabelKey: 'lead',
      category: 'SUBMIT_LEAD_FORM',
      recommendedRole: 'primary',
      group: 'leads',
    },
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
  // CHA-231 gap 1 — récupération d'offre via /api/chat/lead-status
  chat_lead_form_recovered: {
    google_ga4: { name: 'chat_lead_form_recovered', isStandard: false },
  },
  // CHA-231 gap 4 — observabilité contrat SSE (interne)
  chat_sse_invalid_event: {
    google_ga4: { name: 'chat_sse_invalid_event', isStandard: false },
  },
};

export function getEventMapping(eventName: string): EventMapping | null {
  return MAP[eventName] ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Attribution Mode (per-provider gating policy)
// ─────────────────────────────────────────────────────────────────────
//
// Détermine si un event doit être **attribution-gated** pour un provider
// donné (= ne fire que sur le canal attribué) ou **broadcast** (= fire
// sur tous les canaux).
//
// Politique :
//   - `primary`   → attribution-gated. Réservé aux conversions PILOTANT
//                   le bidding (Purchase, Lead). Empêche la double-
//                   attribution cross-provider qui skewerait Smart
//                   Bidding (ex. clic Meta + Purchase compté Ads).
//   - `broadcast` → fire sur tous les canaux. Pour les secondary
//                   conversions (add_to_cart, checkout_intent, sign_up,
//                   newsletter, video_complete, journal_read, …) et
//                   pour les audience events (view_item, view_cart,
//                   add_payment_info, …). Volume max pour alimenter
//                   les algorithmes d'observation.
//
// Source de vérité par provider :
//   - Google Ads : `google_ads.recommendedRole`
//                  → la config UI Google Ads est la SoT pour les rôles ;
//                    le mapping doit refléter la conv UI (sinon mismatch
//                    de comptage entre fire-side et bidding-side).
//   - Meta       : hardcoded `META_PRIMARY_NAMES`. Meta n'a pas de
//                    distinction primary/secondary native ; on
//                    considère que seuls Purchase + Lead pilotent le
//                    bidding Advantage+ (les autres = funnel/audience).
//   - TikTok     : hardcoded `TIKTOK_PRIMARY_NAMES`. Idem Meta —
//                    CompletePayment = primary, SubmitForm = primary
//                    (puisque lead campaigns optimisent là-dessus).
//   - Snap       : hardcoded `SNAP_PRIMARY_NAMES`. Purchase + SignUp
//                    pilotent les campagnes conversion/lead Snapchat.
//
// Cf. docs/tracking-attribution/03-architecture.md pour la matrice
// complète et les exemples de comportement par flow.

export type AttributionMode = 'primary' | 'broadcast';

export type AttributionProvider = 'meta' | 'google_ads' | 'tiktok' | 'snap';

const META_PRIMARY_NAMES: ReadonlySet<string> = new Set(['Purchase', 'Lead']);
const TIKTOK_PRIMARY_NAMES: ReadonlySet<string> = new Set([
  'Purchase',
  'SubmitForm',
]);
const SNAP_PRIMARY_NAMES: ReadonlySet<string> = new Set(['PURCHASE', 'SIGN_UP', 'LEAD']);

/**
 * Retourne le mode d'attribution pour `(eventKey, provider)`.
 *
 * - `'primary'`   → tag attribution-gated (CUSTOM_EVENT + filter
 *                   `attribution.channel ∈ {provider|direct|organic|broadcast}`).
 * - `'broadcast'` → tag standard (CUSTOM_EVENT sans filtre attribution).
 *
 * Default safety : si l'event est inconnu, on retourne `'broadcast'`
 * pour éviter de jamais bloquer un signal par accident.
 */
export function getAttributionMode(
  eventKey: string,
  provider: AttributionProvider,
): AttributionMode {
  const mapping = MAP[eventKey];
  if (!mapping) return 'broadcast';
  if (provider === 'google_ads') {
    return mapping.google_ads?.recommendedRole === 'primary'
      ? 'primary'
      : 'broadcast';
  }
  if (provider === 'meta') {
    const metaName = mapping.meta?.name;
    return metaName && META_PRIMARY_NAMES.has(metaName) ? 'primary' : 'broadcast';
  }
  if (provider === 'tiktok') {
    const tiktokName = mapping.tiktok?.name;
    return tiktokName && TIKTOK_PRIMARY_NAMES.has(tiktokName)
      ? 'primary'
      : 'broadcast';
  }
  if (provider === 'snap') {
    const snapName = mapping.snap?.name;
    return snapName && SNAP_PRIMARY_NAMES.has(snapName)
      ? 'primary'
      : 'broadcast';
  }
  return 'broadcast';
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

/**
 * Description enrichie d'une conversion Google Ads candidate.
 * Plusieurs events FemiGlow peuvent partager le même
 * `conversionLabelKey` (ex. lead_capture + generate_lead +
 * chat_lead_form_submit → 'lead').
 */
export interface AdsConversionDescriptor {
  conversionLabelKey: string;
  events: string[];
  category: AdsConversionCategory;
  recommendedRole: AdsConversionRole;
  group: AdsConversionGroup;
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

/**
 * Liste dédupliquée des conversions Google Ads (1 entrée par
 * `conversionLabelKey`, agrégeant tous les events qui la déclenchent).
 * Pratique pour l'UI admin (1 label saisi → N events).
 *
 * Sortie ordonnée par `group` (sales → leads → further) puis par
 * `recommendedRole` (primary → secondary), pour matcher l'ordre des
 * priorités côté admin.
 */
export function listAdsConversions(): AdsConversionDescriptor[] {
  const byKey = new Map<string, AdsConversionDescriptor>();
  for (const [eventName, entry] of Object.entries(MAP)) {
    const ads = entry.google_ads;
    if (!ads?.conversionLabelKey) continue;
    const key = ads.conversionLabelKey;
    const existing = byKey.get(key);
    if (existing) {
      existing.events.push(eventName);
    } else {
      byKey.set(key, {
        conversionLabelKey: key,
        events: [eventName],
        category: ads.category ?? 'DEFAULT',
        recommendedRole: ads.recommendedRole ?? 'secondary',
        group: ads.group ?? 'further',
      });
    }
  }
  const out = Array.from(byKey.values());
  const groupOrder: Record<AdsConversionGroup, number> = {
    sales: 0,
    leads: 1,
    further: 2,
  };
  const roleOrder: Record<AdsConversionRole, number> = {
    primary: 0,
    secondary: 1,
  };
  out.sort((a, b) => {
    const g = groupOrder[a.group] - groupOrder[b.group];
    if (g !== 0) return g;
    return roleOrder[a.recommendedRole] - roleOrder[b.recommendedRole];
  });
  // Stable order pour les events partagés.
  for (const d of out) d.events.sort();
  return out;
}
