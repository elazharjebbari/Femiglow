/**
 * Mappings events × providers — SOURCE DE VÉRITÉ UNIQUE.
 *
 * Référence : `docs/live-systems-fix-2026-05/08-system-tracking.md` § S4
 *
 * Avant : chaque provider avait son propre mapping inline et inconsistant.
 *  - Meta : skip si non mappé
 *  - GA4 : envoie le nom canonique brut
 *  - TikTok : envoie 'CustomEvent' littéral
 *
 * Après : ce module centralise la matrice events × providers. Comportements
 * uniformes, audit-friendly, testable.
 *
 * Catégories de mapping :
 *  - string : nom mappé (ex: `view_item` → `ViewContent` pour Meta)
 *  - 'as-is' : envoie le nom canonique tel quel (ex: GA4 `view_item`)
 *  - 'skip' : ne dispatche pas (volonté explicite — pas un fallback)
 *  - undefined (absent) : non mappé → fallback config (drop OR custom)
 */

export type ProviderName =
  | 'meta'
  | 'ga4'
  | 'google_ads'
  | 'tiktok'
  | 'snap'
  | 'pinterest';

type Mapping = string | 'as-is' | 'skip';

/**
 * Matrice events × providers.
 *
 * Sources :
 *  - Meta : https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/event-name
 *  - GA4 : https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference/events
 *  - TikTok : https://business-api.tiktok.com/portal/docs?id=1741601162187777
 *  - Snap : https://developers.snap.com/api/marketing-api/Conversions-API/Parameters
 *  - Pinterest : https://developers.pinterest.com/docs/conversions/conversions
 *  - Google Ads : conversion type via conversion_action (pas un eventName)
 */
const EVENT_MAPPINGS: Record<string, Partial<Record<ProviderName, Mapping>>> = {
  // Page / interaction
  page_view: {
    meta: 'PageView',
    ga4: 'as-is',
    tiktok: 'as-is',
    snap: 'PAGE_VIEW',
    pinterest: 'pagevisit',
  },
  scroll_depth: {
    meta: 'skip',
    ga4: 'as-is',
    tiktok: 'skip',
  },

  // E-commerce funnel
  view_item: {
    meta: 'ViewContent',
    ga4: 'as-is',
    tiktok: 'ViewContent',
    snap: 'VIEW_CONTENT',
    pinterest: 'pagevisit',
  },
  view_item_list: {
    meta: 'ViewContent',
    ga4: 'as-is',
    tiktok: 'ViewContent',
  },
  select_item: {
    meta: 'ViewContent',
    ga4: 'as-is',
  },
  add_to_cart: {
    meta: 'AddToCart',
    ga4: 'as-is',
    tiktok: 'AddToCart',
    snap: 'ADD_CART',
    pinterest: 'addtocart',
  },
  remove_from_cart: {
    meta: 'skip',
    ga4: 'as-is',
  },
  view_cart: {
    meta: 'ViewContent',
    ga4: 'as-is',
  },
  begin_checkout: {
    meta: 'InitiateCheckout',
    ga4: 'as-is',
    tiktok: 'InitiateCheckout',
    snap: 'START_CHECKOUT',
    pinterest: 'checkout',
  },
  add_shipping_info: {
    meta: 'skip',
    ga4: 'as-is',
  },
  add_payment_info: {
    meta: 'AddPaymentInfo',
    ga4: 'as-is',
    tiktok: 'AddPaymentInfo',
  },
  purchase: {
    meta: 'Purchase',
    ga4: 'as-is',
    google_ads: 'conversion',
    tiktok: 'CompletePayment',
    snap: 'PURCHASE',
    pinterest: 'checkout',
  },
  refund: {
    meta: 'skip',
    ga4: 'as-is',
  },

  // Lead
  generate_lead: {
    meta: 'Lead',
    ga4: 'as-is',
    google_ads: 'conversion',
    tiktok: 'CompleteRegistration', // closest approx — TikTok n'a pas 'Lead'
    snap: 'SIGN_UP',
    pinterest: 'lead',
  },
  lead_capture: {
    meta: 'Lead',
    ga4: 'as-is',
    tiktok: 'CompleteRegistration',
    snap: 'SIGN_UP',
    pinterest: 'lead',
  },
  sign_up: {
    meta: 'CompleteRegistration',
    ga4: 'as-is',
    tiktok: 'CompleteRegistration',
    snap: 'SIGN_UP',
  },
  newsletter_subscribe: {
    meta: 'Subscribe',
    ga4: 'as-is',
    tiktok: 'Subscribe',
  },

  // Engagement
  contact: {
    meta: 'Contact',
    ga4: 'as-is',
    tiktok: 'Contact',
  },
  click: {
    meta: 'skip',
    ga4: 'as-is',
  },
  share: {
    meta: 'skip',
    ga4: 'as-is',
  },
  search: {
    meta: 'Search',
    ga4: 'as-is',
    tiktok: 'Search',
  },
};

export interface MappedEvent {
  /** Nom à envoyer au provider. Null si skip ou non mappé. */
  name: string | null;
  /** True si on doit explicitement ne pas dispatcher cet event. */
  skip: boolean;
  /** True si le mapping a un sens éditorial (vs fallback). */
  mapped: boolean;
}

/**
 * Mappe un nom d'event canonique vers le nom attendu par un provider.
 *
 * Comportements possibles :
 *  - { name: 'ViewContent', skip: false, mapped: true }  → mapped explicit
 *  - { name: 'view_item', skip: false, mapped: true }    → as-is (GA4)
 *  - { name: null, skip: true, mapped: true }            → skip explicite
 *  - { name: null, skip: true, mapped: false }           → non mappé (fallback drop)
 */
export function mapEventName(
  eventName: string,
  provider: ProviderName,
): MappedEvent {
  const mapping = EVENT_MAPPINGS[eventName]?.[provider];

  if (mapping === undefined) {
    return { name: null, skip: true, mapped: false };
  }
  if (mapping === 'skip') {
    return { name: null, skip: true, mapped: true };
  }
  if (mapping === 'as-is') {
    return { name: eventName, skip: false, mapped: true };
  }
  return { name: mapping, skip: false, mapped: true };
}

/**
 * Retourne la liste des events supportés par un provider donné.
 * Utile pour debug / dashboard admin.
 */
export function listSupportedEvents(provider: ProviderName): string[] {
  return Object.entries(EVENT_MAPPINGS)
    .filter(([, mappings]) => {
      const m = mappings[provider];
      return m !== undefined && m !== 'skip';
    })
    .map(([name]) => name);
}

/**
 * Retourne les events explicitement skip pour un provider.
 * Utile pour audit (vérifier que rien d'important n'est skipé par erreur).
 */
export function listSkippedEvents(provider: ProviderName): string[] {
  return Object.entries(EVENT_MAPPINGS)
    .filter(([, mappings]) => mappings[provider] === 'skip')
    .map(([name]) => name);
}
