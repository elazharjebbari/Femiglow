/**
 * Checkout / Wizard event payload builders.
 *
 * Référence : docs/checkout-funnel/05-plan-action.md §2 PR #1, §3 PR #5-PR #7.
 *
 * Objectifs
 * ─────────
 * 1. **Type-safety** : chaque event a un payload typé (`*Input`) et un payload
 *    de sortie (`*Event`) avec uniquement les champs définis dans la
 *    taxonomie. Les `undefined` sont systématiquement éliminés via
 *    `stripUndefined` pour produire un objet propre côté dataLayer.
 *
 * 2. **Cohérence** : tous les events du tunnel partagent les mêmes attributs
 *    transverses — `form_id`, `form_mode`, `step_name`, `variant_key`,
 *    `lead_id?` — fournis par `withWizardContext`. Cela permet aux requêtes
 *    GA4 / Meta de pivoter sans surprises entre les events.
 *
 * 3. **GA4-conformity** : les builders ecommerce (`buildBeginCheckoutEvent`,
 *    `buildAddShippingInfoEvent`, `buildAddPaymentInfoEvent`,
 *    `buildPurchaseEvent`) produisent une shape strictement conforme à la
 *    documentation officielle Enhanced Ecommerce (currency / value / items[]).
 *
 * 4. **Idempotence d'écriture** : les builders sont des **fonctions pures**.
 *    Aucun effet de bord, aucun accès `window`. Ils peuvent être appelés en
 *    SSR comme en CSR, ce qui rend les tests Vitest triviaux.
 *
 * 5. **Schema versioning** : chaque event embarque un `schema_version` figé
 *    (`v1`) pour permettre d'évoluer la taxonomie sans casser les dashboards
 *    GA4 / Looker existants.
 *
 * À NE PAS faire ici :
 *  - Aucun appel à `emit()` ou à un provider : ces builders ne servent qu'à
 *    fabriquer le payload. L'émission est de la responsabilité du composant
 *    appelant (`useTracking()`).
 *  - Aucune logique conditionnelle d'environnement : les valeurs par défaut
 *    (currency = 'MAD') sont constantes et explicitement overridable.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Schema version constant
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Version du schéma de payload pour les events checkout/wizard.
 * À incrémenter en cas de breaking change (rename de champs, retrait
 * d'attribut requis). Consommé par les dashboards GA4 pour différencier
 * les générations de tracking.
 */
export const CHECKOUT_EVENTS_SCHEMA_VERSION = 'v1' as const;

/** Devise par défaut côté tunnel FemiGlow (Maroc). */
export const DEFAULT_CURRENCY = 'MAD' as const;

// ─────────────────────────────────────────────────────────────────────────────
// Types transverses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mode de présentation du wizard, croisé avec l'expérience d'origine.
 *  - `wizard_embed` : le wizard est embedded inline sur la page produit (`/kit`).
 *  - `wizard_cart`  : le wizard remplace le panier classique (`/commander`).
 *  - `legacy_cart`  : ancien CheckoutFlow (avant migration). Conservé pour la
 *    période de double run (PR #8 / PR #9 / PR #10).
 */
export type FormMode = 'wizard_embed' | 'wizard_cart' | 'legacy_cart';

/**
 * Étape du wizard. La chaîne est utilisée telle quelle dans la dataLayer
 * (pas de mapping localisé). Ordre logique : `lead → address → payment →
 * thank_you`. `cart_review` est réservé au mode B (préliminaire au tunnel).
 */
export type WizardStepName =
  | 'cart_review'
  | 'lead'
  | 'address'
  | 'payment'
  | 'thank_you';

/**
 * Clé de variant pour l'A/B test du mode d'embed (PR #8 / PR #9).
 * `null` quand l'utilisateur n'est pas assigné (ex. legacy ou rollout 0%).
 */
export type VariantKey = 'A' | 'B' | 'control' | null;

/**
 * Contexte transverse partagé par tous les events du tunnel. Tous les
 * builders ci-dessous l'acceptent en entrée et le re-projettent en sortie.
 */
export interface WizardContext {
  /** Identifiant stable du formulaire (`wizard_kit`, `wizard_commander`, …). */
  form_id: string;
  /** Mode de présentation. */
  form_mode: FormMode;
  /** Étape courante. */
  step_name: WizardStepName;
  /** Clé de variant A/B (peut être `null`). */
  variant_key: VariantKey;
  /** ID du `chat_lead` (depuis `/api/checkout/lead`). Optionnel pré-création. */
  lead_id?: string | null;
}

/** Description normalisée d'un item GA4 / Meta. */
export interface EcommerceItem {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
  currency?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retire les propriétés `undefined` d'un objet. Préserve les clés à `null`
 * (utile pour signaler explicitement « non assigné », ex. `variant_key`).
 * N'opère que sur le premier niveau — les builders ci-dessous fabriquent
 * eux-mêmes leurs sous-objets.
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
}

/**
 * Construit la base commune à tous les events du tunnel. La fonction est
 * intentionnellement minimale : elle ne fait que projeter le contexte +
 * appliquer `stripUndefined` pour éliminer un éventuel `lead_id` non fourni.
 *
 * @internal — non destinée à un usage externe, exposée uniquement pour les
 * tests qui veulent vérifier la projection.
 */
export function withWizardContext<E extends Record<string, unknown>>(
  ctx: WizardContext,
  extra: E,
): E & WizardContext & { schema_version: typeof CHECKOUT_EVENTS_SCHEMA_VERSION } {
  return stripUndefined({
    form_id: ctx.form_id,
    form_mode: ctx.form_mode,
    step_name: ctx.step_name,
    variant_key: ctx.variant_key,
    lead_id: ctx.lead_id ?? undefined,
    schema_version: CHECKOUT_EVENTS_SCHEMA_VERSION,
    ...extra,
  }) as E & WizardContext & { schema_version: typeof CHECKOUT_EVENTS_SCHEMA_VERSION };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. lead_capture (step 1 — InfoStep) ✅ CONVERSION (generate_lead alias)
// ─────────────────────────────────────────────────────────────────────────────

export interface LeadCaptureInput {
  ctx: WizardContext;
  /** Méthode de capture (UI / chat / form externe). */
  method?: 'wizard' | 'chat' | 'newsletter';
  /** Liste des canaux de contact opt-in cochés. */
  contact_channels?: Array<'phone' | 'email' | 'sms'>;
  /** Devise. Defaut MAD. */
  currency?: string;
  /** Valeur attendue (ex. snapshot panier MAD). Optionnel. */
  value?: number;
}

export interface LeadCaptureEvent extends WizardContext {
  schema_version: typeof CHECKOUT_EVENTS_SCHEMA_VERSION;
  method: 'wizard' | 'chat' | 'newsletter';
  contact_channels: Array<'phone' | 'email' | 'sms'>;
  currency: string;
  value?: number;
}

/**
 * Émet un signal de capture de lead (step 1 du wizard).
 * - Conversion : oui (déclenche `generate_lead` Meta côté mapping).
 * - Doit toujours inclure `lead_id` (issue de `/api/checkout/lead`).
 */
export function buildLeadCaptureEvent(input: LeadCaptureInput): LeadCaptureEvent {
  return withWizardContext(input.ctx, {
    method: input.method ?? 'wizard',
    contact_channels: input.contact_channels ?? ['phone'],
    currency: input.currency ?? DEFAULT_CURRENCY,
    value: input.value,
  }) as LeadCaptureEvent;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. address_completed (step 2 — AddressStep)
// ─────────────────────────────────────────────────────────────────────────────

export interface AddressCompletedInput {
  ctx: WizardContext;
  /** Tier de livraison (ex. 'standard', 'express'). */
  shipping_tier?: string;
  /** Code ville (slug stable, ex. 'casablanca'). */
  city_code?: string;
  /** Devise. Defaut MAD. */
  currency?: string;
  /** Items panier (snapshot). */
  items?: EcommerceItem[];
  /** Total panier (currency). */
  value?: number;
}

export interface AddressCompletedEvent extends WizardContext {
  schema_version: typeof CHECKOUT_EVENTS_SCHEMA_VERSION;
  shipping_tier?: string;
  city_code?: string;
  currency: string;
  items?: EcommerceItem[];
  value?: number;
}

/**
 * Step 2 complétée (adresse + ville validées). Pas une conversion :
 * c'est un signal de progression. Mappe vers GA4 `add_shipping_info`.
 */
export function buildAddressCompletedEvent(
  input: AddressCompletedInput,
): AddressCompletedEvent {
  return withWizardContext(input.ctx, {
    shipping_tier: input.shipping_tier,
    city_code: input.city_code,
    currency: input.currency ?? DEFAULT_CURRENCY,
    items: input.items,
    value: input.value,
  }) as AddressCompletedEvent;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. wizard_error (validation client / API)
// ─────────────────────────────────────────────────────────────────────────────

export type WizardErrorSource = 'client_validation' | 'api' | 'network' | 'stock';

export interface WizardErrorInput {
  ctx: WizardContext;
  /** Source de l'erreur (côté client vs serveur vs réseau vs stock). */
  source: WizardErrorSource;
  /** Code stable (ex. 'PHONE_INVALID', 'LEAD_RATE_LIMITED'). */
  error_code: string;
  /** Champ concerné (si validation client). */
  field_name?: string;
  /** Statut HTTP (si source = 'api'). */
  http_status?: number;
}

export interface WizardErrorEvent extends WizardContext {
  schema_version: typeof CHECKOUT_EVENTS_SCHEMA_VERSION;
  source: WizardErrorSource;
  error_code: string;
  field_name?: string;
  http_status?: number;
}

export function buildWizardErrorEvent(input: WizardErrorInput): WizardErrorEvent {
  return withWizardContext(input.ctx, {
    source: input.source,
    error_code: input.error_code,
    field_name: input.field_name,
    http_status: input.http_status,
  }) as WizardErrorEvent;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. wizard_abandoned (pagehide / unmount sans soumission finale)
// ─────────────────────────────────────────────────────────────────────────────

export interface WizardAbandonedInput {
  ctx: WizardContext;
  /** Étape la plus avancée atteinte avant l'abandon. */
  last_step_reached: WizardStepName;
  /** Temps passé sur le wizard (ms). */
  time_on_wizard_ms: number;
  /** Dernier champ focus (utile pour identifier le blocage). */
  last_field?: string;
}

export interface WizardAbandonedEvent extends WizardContext {
  schema_version: typeof CHECKOUT_EVENTS_SCHEMA_VERSION;
  last_step_reached: WizardStepName;
  time_on_wizard_ms: number;
  last_field?: string;
}

export function buildWizardAbandonedEvent(
  input: WizardAbandonedInput,
): WizardAbandonedEvent {
  return withWizardContext(input.ctx, {
    last_step_reached: input.last_step_reached,
    time_on_wizard_ms: input.time_on_wizard_ms,
    last_field: input.last_field,
  }) as WizardAbandonedEvent;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. begin_checkout (extension wizard du builder GA4 standard)
// ─────────────────────────────────────────────────────────────────────────────

export interface BeginCheckoutInput {
  ctx: WizardContext;
  currency?: string;
  value: number;
  items: EcommerceItem[];
  coupon?: string;
}

export interface BeginCheckoutEvent extends WizardContext {
  schema_version: typeof CHECKOUT_EVENTS_SCHEMA_VERSION;
  currency: string;
  value: number;
  items: EcommerceItem[];
  coupon?: string;
}

export function buildBeginCheckoutEvent(input: BeginCheckoutInput): BeginCheckoutEvent {
  return withWizardContext(input.ctx, {
    currency: input.currency ?? DEFAULT_CURRENCY,
    value: input.value,
    items: input.items,
    coupon: input.coupon,
  }) as BeginCheckoutEvent;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. add_payment_info (step 3 — PaymentStep) ✅ NORMALISÉ wizard
// ─────────────────────────────────────────────────────────────────────────────

export type PaymentType = 'cod' | 'bank_transfer' | 'card';

export interface AddPaymentInfoInput {
  ctx: WizardContext;
  payment_type: PaymentType;
  currency?: string;
  value?: number;
  items?: EcommerceItem[];
}

export interface AddPaymentInfoEvent extends WizardContext {
  schema_version: typeof CHECKOUT_EVENTS_SCHEMA_VERSION;
  payment_type: PaymentType;
  currency: string;
  value?: number;
  items?: EcommerceItem[];
}

export function buildAddPaymentInfoEvent(input: AddPaymentInfoInput): AddPaymentInfoEvent {
  return withWizardContext(input.ctx, {
    payment_type: input.payment_type,
    currency: input.currency ?? DEFAULT_CURRENCY,
    value: input.value,
    items: input.items,
  }) as AddPaymentInfoEvent;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. purchase (step 4 — ThankYouStep) ✅ CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

export interface PurchaseInput {
  ctx: WizardContext;
  /** ID de transaction (déduplication GA4 / Meta). REQUIS pour la conversion. */
  transaction_id: string;
  currency?: string;
  value: number;
  items: EcommerceItem[];
  tax?: number;
  shipping?: number;
  coupon?: string;
  payment_type?: PaymentType;
}

export interface PurchaseEvent extends WizardContext {
  schema_version: typeof CHECKOUT_EVENTS_SCHEMA_VERSION;
  transaction_id: string;
  currency: string;
  value: number;
  items: EcommerceItem[];
  tax?: number;
  shipping?: number;
  coupon?: string;
  payment_type?: PaymentType;
}

export function buildPurchaseEvent(input: PurchaseInput): PurchaseEvent {
  return withWizardContext(input.ctx, {
    transaction_id: input.transaction_id,
    currency: input.currency ?? DEFAULT_CURRENCY,
    value: input.value,
    items: input.items,
    tax: input.tax,
    shipping: input.shipping,
    coupon: input.coupon,
    payment_type: input.payment_type,
  }) as PurchaseEvent;
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports for ergonomics
// ─────────────────────────────────────────────────────────────────────────────

export const CHECKOUT_EVENT_NAMES = {
  leadCapture: 'lead_capture',
  addressCompleted: 'address_completed',
  wizardError: 'wizard_error',
  wizardAbandoned: 'wizard_abandoned',
  beginCheckout: 'begin_checkout',
  addPaymentInfo: 'add_payment_info',
  purchase: 'purchase',
} as const;

export type CheckoutEventName =
  (typeof CHECKOUT_EVENT_NAMES)[keyof typeof CHECKOUT_EVENT_NAMES];
