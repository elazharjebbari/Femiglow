/**
 * Catalogue des events standards par plateforme.
 *
 * Source de vérité unique pour :
 *  - L'autocomplete dans le `MappingCellEditor` (UI)
 *  - La validation enrichie (détection des typos / suggestion isCustom)
 *  - La documentation interne du tracking
 *
 * Maintenance : à mettre à jour quand un vendor ajoute/retire un standard
 * (1-2 PR/an typiquement). Garder en sync avec la doc officielle de chaque
 * plateforme.
 *
 * Sources officielles consultées :
 *  - Meta Pixel : https://developers.facebook.com/docs/meta-pixel/reference#standard-events
 *  - GA4 : https://developers.google.com/analytics/devguides/collection/ga4/reference/events
 *  - TikTok Events : https://business-api.tiktok.com/portal/docs?id=1771101303285761
 *  - Snap CAPI : https://businesshelp.snapchat.com/s/article/conversions-api
 *  - Pinterest CAPI : https://developers.pinterest.com/docs/api-features/conversion-overview/
 *  - Google Ads : conversion actions, libres (pas de liste figée)
 *
 * Cf. ADR-004 (provider config shape) + docs/event-mappings/30-backend/validation-rules.md
 */
import type { MappingProviderKind } from '@/lib/tracking/mappings/types';

export interface StandardEvent {
  /** Nom officiel exact (respect orthographe + casse). */
  name: string;
  /** Label humain pour l'UI dropdown. */
  label: string;
  /** Description courte pour le tooltip / hint. */
  description?: string;
  /** True si l'event est une conversion native côté vendor (boost algo). */
  isConversion?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Meta Pixel / Conversions API
// ──────────────────────────────────────────────────────────────────────────────
const META: StandardEvent[] = [
  { name: 'PageView', label: 'Page vue', description: 'Vue de page (équivalent gtag page_view)' },
  { name: 'ViewContent', label: 'Contenu vu', description: 'Vue d\'un contenu/produit', isConversion: true },
  { name: 'Search', label: 'Recherche', description: 'Soumission de recherche' },
  { name: 'AddToCart', label: 'Ajout panier', description: 'Article ajouté au panier', isConversion: true },
  { name: 'AddToWishlist', label: 'Ajout wishlist', description: 'Article ajouté aux favoris' },
  { name: 'InitiateCheckout', label: 'Début checkout', description: 'Entrée dans le tunnel d\'achat', isConversion: true },
  { name: 'AddPaymentInfo', label: 'Infos paiement', description: 'Info paiement renseignée' },
  { name: 'Purchase', label: 'Achat', description: 'Conversion achat finalisé', isConversion: true },
  { name: 'Lead', label: 'Lead', description: 'Capture de lead', isConversion: true },
  { name: 'CompleteRegistration', label: 'Inscription', description: 'Création de compte', isConversion: true },
  { name: 'Contact', label: 'Contact', description: 'Contact pris (call, msg, form)' },
  { name: 'CustomizeProduct', label: 'Personnalisation', description: 'Configuration d\'un produit' },
  { name: 'Donate', label: 'Don', description: 'Donation effectuée', isConversion: true },
  { name: 'FindLocation', label: 'Localisation', description: 'Recherche d\'un point de vente' },
  { name: 'Schedule', label: 'RDV pris', description: 'Prise de rendez-vous' },
  { name: 'StartTrial', label: 'Essai démarré', description: 'Début d\'un essai gratuit', isConversion: true },
  { name: 'SubmitApplication', label: 'Candidature', description: 'Soumission de candidature' },
  { name: 'Subscribe', label: 'Abonnement', description: 'Souscription récurrente', isConversion: true },
];

// ──────────────────────────────────────────────────────────────────────────────
// Google Analytics 4 — recommended events
// ──────────────────────────────────────────────────────────────────────────────
const GA4: StandardEvent[] = [
  { name: 'page_view', label: 'Page view' },
  { name: 'screen_view', label: 'Screen view' },
  { name: 'login', label: 'Login' },
  { name: 'sign_up', label: 'Sign up', isConversion: true },
  { name: 'search', label: 'Search' },
  { name: 'select_content', label: 'Select content' },
  { name: 'share', label: 'Share' },
  { name: 'click', label: 'Click' },
  { name: 'file_download', label: 'File download' },
  { name: 'generate_lead', label: 'Generate lead', isConversion: true },
  { name: 'join_group', label: 'Join group' },
  // E-commerce
  { name: 'view_item_list', label: 'View item list' },
  { name: 'select_item', label: 'Select item' },
  { name: 'view_item', label: 'View item' },
  { name: 'add_to_cart', label: 'Add to cart', isConversion: true },
  { name: 'remove_from_cart', label: 'Remove from cart' },
  { name: 'view_cart', label: 'View cart' },
  { name: 'begin_checkout', label: 'Begin checkout', isConversion: true },
  { name: 'add_shipping_info', label: 'Add shipping info' },
  { name: 'add_payment_info', label: 'Add payment info' },
  { name: 'purchase', label: 'Purchase', isConversion: true },
  { name: 'refund', label: 'Refund' },
  { name: 'view_promotion', label: 'View promotion' },
  { name: 'select_promotion', label: 'Select promotion' },
  { name: 'add_to_wishlist', label: 'Add to wishlist' },
  // Engagement
  { name: 'scroll', label: 'Scroll' },
  { name: 'video_start', label: 'Video start' },
  { name: 'video_progress', label: 'Video progress' },
  { name: 'video_complete', label: 'Video complete' },
  // Forms
  { name: 'form_start', label: 'Form start' },
  { name: 'form_submit', label: 'Form submit', isConversion: true },
  { name: 'phone_call', label: 'Phone call' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Google Ads — conversion action categories (pas events au sens strict)
// ──────────────────────────────────────────────────────────────────────────────
const GOOGLE_ADS: StandardEvent[] = [
  { name: 'purchase', label: 'Purchase', isConversion: true },
  { name: 'signup', label: 'Sign-up', isConversion: true },
  { name: 'lead', label: 'Lead', isConversion: true },
  { name: 'contact', label: 'Contact', isConversion: true },
  { name: 'submit_lead_form', label: 'Submit lead form', isConversion: true },
  { name: 'book_appointment', label: 'Book appointment', isConversion: true },
  { name: 'request_quote', label: 'Request quote', isConversion: true },
  { name: 'subscribe_paid', label: 'Paid subscription', isConversion: true },
  { name: 'get_directions', label: 'Get directions' },
  { name: 'outbound_click', label: 'Outbound click' },
  { name: 'page_view', label: 'Page view' },
  { name: 'add_to_cart', label: 'Add to cart' },
  { name: 'begin_checkout', label: 'Begin checkout' },
  { name: 'generate_lead', label: 'Generate lead', isConversion: true },
];

// ──────────────────────────────────────────────────────────────────────────────
// TikTok Events API — standard events
// ──────────────────────────────────────────────────────────────────────────────
const TIKTOK: StandardEvent[] = [
  { name: 'AddPaymentInfo', label: 'Add payment info' },
  { name: 'AddToCart', label: 'Add to cart', isConversion: true },
  { name: 'AddToWishlist', label: 'Add to wishlist' },
  { name: 'ClickButton', label: 'Click button' },
  { name: 'CompletePayment', label: 'Complete payment', isConversion: true },
  { name: 'CompleteRegistration', label: 'Complete registration', isConversion: true },
  { name: 'Contact', label: 'Contact' },
  { name: 'Download', label: 'Download' },
  { name: 'InitiateCheckout', label: 'Initiate checkout', isConversion: true },
  { name: 'PlaceAnOrder', label: 'Place an order', isConversion: true },
  { name: 'Search', label: 'Search' },
  { name: 'SubmitForm', label: 'Submit form', isConversion: true },
  { name: 'Subscribe', label: 'Subscribe', isConversion: true },
  { name: 'ViewContent', label: 'View content' },
  { name: 'Pageview', label: 'Pageview' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Snap CAPI — standard events (UPPER_SNAKE_CASE)
// ──────────────────────────────────────────────────────────────────────────────
const SNAP: StandardEvent[] = [
  { name: 'PAGE_VIEW', label: 'Page view' },
  { name: 'VIEW_CONTENT', label: 'View content' },
  { name: 'SEARCH', label: 'Search' },
  { name: 'ADD_CART', label: 'Add to cart', isConversion: true },
  { name: 'ADD_BILLING', label: 'Add billing info' },
  { name: 'START_CHECKOUT', label: 'Start checkout', isConversion: true },
  { name: 'PURCHASE', label: 'Purchase', isConversion: true },
  { name: 'SAVE', label: 'Save' },
  { name: 'SIGN_UP', label: 'Sign up', isConversion: true },
  { name: 'COMPLETED_TUTORIAL', label: 'Completed tutorial' },
  { name: 'LIST_VIEW', label: 'List view' },
  { name: 'ACHIEVEMENT_UNLOCKED', label: 'Achievement unlocked' },
  { name: 'ADD_TO_WISHLIST', label: 'Add to wishlist' },
  { name: 'INVITE', label: 'Invite' },
  { name: 'LOGIN', label: 'Login' },
  { name: 'SHARE', label: 'Share' },
  { name: 'RESERVE', label: 'Reserve' },
  { name: 'APP_OPEN', label: 'App open' },
  { name: 'AD_VIEW', label: 'Ad view' },
  { name: 'AD_CLICK', label: 'Ad click' },
  { name: 'LEVEL_COMPLETE', label: 'Level complete' },
  { name: 'RATE', label: 'Rate' },
  { name: 'SPENT_CREDITS', label: 'Spent credits' },
  { name: 'SUBSCRIBE', label: 'Subscribe', isConversion: true },
  { name: 'TRIAL_STARTED', label: 'Trial started', isConversion: true },
  { name: 'CUSTOM_EVENT_1', label: 'Custom event 1' },
  { name: 'CUSTOM_EVENT_2', label: 'Custom event 2' },
  { name: 'CUSTOM_EVENT_3', label: 'Custom event 3' },
  { name: 'CUSTOM_EVENT_4', label: 'Custom event 4' },
  { name: 'CUSTOM_EVENT_5', label: 'Custom event 5' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Pinterest Conversions API
// ──────────────────────────────────────────────────────────────────────────────
const PINTEREST: StandardEvent[] = [
  { name: 'pagevisit', label: 'Page visit' },
  { name: 'viewcategory', label: 'View category' },
  { name: 'search', label: 'Search' },
  { name: 'addtocart', label: 'Add to cart', isConversion: true },
  { name: 'checkout', label: 'Checkout', isConversion: true },
  { name: 'watchvideo', label: 'Watch video' },
  { name: 'signup', label: 'Sign up', isConversion: true },
  { name: 'lead', label: 'Lead', isConversion: true },
  { name: 'custom', label: 'Custom event' },
];

export const STANDARD_EVENTS_BY_KIND: Readonly<Record<MappingProviderKind, readonly StandardEvent[]>> = Object.freeze({
  meta: META,
  google_ga4: GA4,
  google_ads: GOOGLE_ADS,
  tiktok: TIKTOK,
  snap: SNAP,
  pinterest: PINTEREST,
});

/** Liste les events standards d'un provider. Immutable. */
export function getStandardEvents(kind: MappingProviderKind): readonly StandardEvent[] {
  return STANDARD_EVENTS_BY_KIND[kind] ?? [];
}

/** True si `name` est un event standard reconnu pour ce provider. */
export function isStandardEvent(name: string, kind: MappingProviderKind): boolean {
  if (!name) return false;
  return STANDARD_EVENTS_BY_KIND[kind]?.some((e) => e.name === name) ?? false;
}

/**
 * Trouve les events standards qui matchent un texte (case-insensitive,
 * substring). Utilisé pour suggestion en cas de typo.
 */
export function findCloseStandardEvents(name: string, kind: MappingProviderKind, limit = 5): StandardEvent[] {
  if (!name) return [];
  const needle = name.toLowerCase();
  const list = STANDARD_EVENTS_BY_KIND[kind] ?? [];
  return list
    .filter((e) => e.name.toLowerCase().includes(needle) || e.label.toLowerCase().includes(needle))
    .slice(0, limit) as StandardEvent[];
}
