import type { TrackingProviderKind } from '@/lib/db/types';

interface EventMapping {
  meta?: string;
  google_ga4?: string;
  google_ads?: string;
  tiktok?: string;
  snap?: string;
  pinterest?: string;
}

const MAP: Record<string, EventMapping> = {
  page_view: {
    meta: 'PageView',
    google_ga4: 'page_view',
    tiktok: 'Pageview',
    snap: 'PAGE_VIEW',
    pinterest: 'pagevisit',
  },
  view_item: {
    meta: 'ViewContent',
    google_ga4: 'view_item',
    tiktok: 'ViewContent',
    snap: 'VIEW_CONTENT',
    pinterest: 'pagevisit',
  },
  view_item_list: {
    meta: 'ViewContent',
    google_ga4: 'view_item_list',
  },
  select_item: {
    google_ga4: 'select_item',
  },
  add_to_cart: {
    meta: 'AddToCart',
    google_ga4: 'add_to_cart',
    tiktok: 'AddToCart',
    snap: 'ADD_CART',
    pinterest: 'addtocart',
  },
  remove_from_cart: {
    google_ga4: 'remove_from_cart',
  },
  view_cart: {
    google_ga4: 'view_cart',
  },
  begin_checkout: {
    meta: 'InitiateCheckout',
    google_ga4: 'begin_checkout',
    tiktok: 'InitiateCheckout',
    snap: 'START_CHECKOUT',
    pinterest: 'checkout',
  },
  add_shipping_info: { google_ga4: 'add_shipping_info' },
  add_payment_info: {
    meta: 'AddPaymentInfo',
    google_ga4: 'add_payment_info',
    tiktok: 'AddPaymentInfo',
    snap: 'ADD_BILLING',
  },
  purchase: {
    meta: 'Purchase',
    google_ga4: 'purchase',
    google_ads: 'purchase',
    tiktok: 'CompletePayment',
    snap: 'PURCHASE',
    pinterest: 'checkout',
  },
  refund: { google_ga4: 'refund' },
  view_promotion: { google_ga4: 'view_promotion' },
  select_promotion: { google_ga4: 'select_promotion' },
  generate_lead: {
    meta: 'Lead',
    google_ga4: 'generate_lead',
    google_ads: 'generate_lead',
    tiktok: 'SubmitForm',
    snap: 'SIGN_UP',
    pinterest: 'lead',
  },
  sign_up: {
    meta: 'CompleteRegistration',
    google_ga4: 'sign_up',
    tiktok: 'CompleteRegistration',
    snap: 'SIGN_UP',
    pinterest: 'signup',
  },
  login: { google_ga4: 'login' },
  search: {
    meta: 'Search',
    google_ga4: 'search',
    tiktok: 'Search',
    pinterest: 'search',
  },
  share: { google_ga4: 'share' },
  scroll_depth: { google_ga4: 'scroll' },
  click: { google_ga4: 'click' },
  select_content: { google_ga4: 'select_content' },
  video_start: { google_ga4: 'video_start' },
  video_progress: { google_ga4: 'video_progress' },
  video_complete: { google_ga4: 'video_complete' },
  file_download: { google_ga4: 'file_download' },
  form_start: { google_ga4: 'form_start' },
  form_submit: { google_ga4: 'form_submit' },
  fg_journal_read_75: { google_ga4: 'fg_journal_read_75' },
  fg_journal_read_100: { google_ga4: 'fg_journal_read_100' },
  fg_section_view: { google_ga4: 'fg_section_view' },
  fg_faq_view: { google_ga4: 'fg_faq_view' },
  fg_composition_open: { google_ga4: 'fg_composition_open' },
  fg_pixel_test: { google_ga4: 'fg_pixel_test' },
  fg_admin_action: { google_ga4: 'fg_admin_action' },
  fg_consent_change: { google_ga4: 'fg_consent_change' },

  // — Chat assistant — cf. docs/gtm/13-events-chat.md
  // Stratégie : tous les events partent à GA4 ; seuls les signaux forts
  // (1re ouverture / 1er message user / lead form submit) partent à Meta
  // pour ne pas dégrader la qualité du signal pixel.
  chat_widget_open: {
    google_ga4: 'chat_widget_open',
    meta: 'ChatEngagement', // gated « 1re fois par session » côté GTM
  },
  chat_widget_close: { google_ga4: 'chat_widget_close' },
  chat_message_sent: {
    google_ga4: 'chat_message_sent',
    meta: 'Contact', // gated « 1er message user par session » côté GTM
  },
  chat_message_received: { google_ga4: 'chat_message_received' },
  chat_message_complete: { google_ga4: 'chat_message_complete' },
  chat_lead_form_offered: { google_ga4: 'chat_lead_form_offered' },
  chat_lead_form_view: { google_ga4: 'chat_lead_form_view' },
  chat_lead_form_focus: { google_ga4: 'chat_lead_form_focus' },
  chat_lead_form_dismiss: { google_ga4: 'chat_lead_form_dismiss' },
  chat_lead_form_submit: {
    google_ga4: 'generate_lead', // double-émission : conversion standard
    meta: 'Lead',
    google_ads: 'generate_lead',
    tiktok: 'SubmitForm',
    snap: 'LEAD',
    pinterest: 'lead',
  },
  chat_lead_webhook_sent: { google_ga4: 'chat_lead_webhook_sent' },
  chat_lead_webhook_failed: { google_ga4: 'chat_lead_webhook_failed' },
  // CHA-231 gap 1 — récupération d'offre via /api/chat/lead-status
  chat_lead_form_recovered: { google_ga4: 'chat_lead_form_recovered' },
  // CHA-231 gap 4 — observabilité contrat SSE (interne)
  chat_sse_invalid_event: { google_ga4: 'chat_sse_invalid_event' },
  chat_suggestion_clicked: { google_ga4: 'chat_suggestion_clicked' },
  chat_feedback: { google_ga4: 'chat_feedback' },
  chat_language_switch: { google_ga4: 'chat_language_switch' },
  chat_error: { google_ga4: 'chat_error' },
  chat_rate_limit_hit: { google_ga4: 'chat_rate_limit_hit' },
  chat_conversion_attributed: { google_ga4: 'chat_conversion_attributed' },
};

export function mapEventName(eventName: string, kind: TrackingProviderKind): string | null {
  const entry = MAP[eventName];
  if (!entry) return null;
  switch (kind) {
    case 'meta':
      return entry.meta ?? null;
    case 'google_ga4':
      return entry.google_ga4 ?? null;
    case 'google_ads':
      return entry.google_ads ?? entry.google_ga4 ?? null;
    case 'tiktok':
      return entry.tiktok ?? null;
    case 'snap':
      return entry.snap ?? null;
    case 'pinterest':
      return entry.pinterest ?? null;
    default:
      return null;
  }
}

export function isEventSupported(eventName: string, kind: TrackingProviderKind): boolean {
  return mapEventName(eventName, kind) !== null;
}
