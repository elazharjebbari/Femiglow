/**
 * Spec des builders d'events checkout/wizard. Référence :
 *  - docs/checkout-funnel/10-tests-strategy.md §3.5
 *  - apps/web/src/lib/tracking/checkout-events.ts (source de vérité)
 *
 * Stratégie de test :
 *  - Chaque builder a 3 cas : (1) shape minimale, (2) shape complète avec
 *    tous les optionnels, (3) propagation correcte du contexte wizard.
 *  - Vérifications transverses : `form_mode`, `step_name`, `variant_key`,
 *    `lead_id` sont projetés dans tous les events.
 *  - Vérifications de défauts : `currency` défaut MAD, `method` défaut
 *    'wizard', `contact_channels` défaut ['phone'].
 *  - `stripUndefined` : les champs optionnels absents n'apparaissent pas
 *    dans l'event final (utile pour limiter le payload dataLayer).
 */
import { describe, expect, it } from 'vitest';

import {
  buildAddPaymentInfoEvent,
  buildAddressCompletedEvent,
  buildBeginCheckoutEvent,
  buildLeadCaptureEvent,
  buildPurchaseEvent,
  buildWizardAbandonedEvent,
  buildWizardErrorEvent,
  CHECKOUT_EVENTS_SCHEMA_VERSION,
  CHECKOUT_EVENT_NAMES,
  DEFAULT_CURRENCY,
  stripUndefined,
  withWizardContext,
  type WizardContext,
} from '../checkout-events';

const baseCtx: WizardContext = {
  form_id: 'wizard_kit',
  form_mode: 'wizard_embed',
  step_name: 'lead',
  variant_key: 'A',
  lead_id: 'cle_01h0abc',
};

describe('stripUndefined', () => {
  it("retire les clés undefined mais préserve null et 0/false/''", () => {
    expect(
      stripUndefined({
        a: undefined,
        b: null,
        c: 0,
        d: false,
        e: '',
        f: 'kept',
      }),
    ).toEqual({ b: null, c: 0, d: false, e: '', f: 'kept' });
  });
});

describe('withWizardContext', () => {
  it('projette le contexte wizard + schema_version dans le payload', () => {
    const ev = withWizardContext(baseCtx, { method: 'wizard' });
    expect(ev).toMatchObject({
      form_id: 'wizard_kit',
      form_mode: 'wizard_embed',
      step_name: 'lead',
      variant_key: 'A',
      lead_id: 'cle_01h0abc',
      schema_version: CHECKOUT_EVENTS_SCHEMA_VERSION,
      method: 'wizard',
    });
  });

  it('omet `lead_id` si absent ou null (pas de clé dans l\'event)', () => {
    const ev = withWizardContext({ ...baseCtx, lead_id: undefined }, {});
    expect(ev).not.toHaveProperty('lead_id');
    const ev2 = withWizardContext({ ...baseCtx, lead_id: null }, {});
    expect(ev2).not.toHaveProperty('lead_id');
  });

  it('préserve `variant_key: null` (signal explicite « non assigné »)', () => {
    const ev = withWizardContext({ ...baseCtx, variant_key: null }, {});
    expect(ev.variant_key).toBeNull();
    expect(ev).toHaveProperty('variant_key');
  });
});

describe('buildLeadCaptureEvent', () => {
  it('shape minimale avec valeurs par défaut (method=wizard, currency=MAD, channels=[phone])', () => {
    const ev = buildLeadCaptureEvent({ ctx: baseCtx });
    expect(ev).toEqual({
      form_id: 'wizard_kit',
      form_mode: 'wizard_embed',
      step_name: 'lead',
      variant_key: 'A',
      lead_id: 'cle_01h0abc',
      schema_version: 'v1',
      method: 'wizard',
      contact_channels: ['phone'],
      currency: DEFAULT_CURRENCY,
      // value omis (undefined)
    });
    expect(ev).not.toHaveProperty('value');
  });

  it('shape complète avec value + contact_channels custom', () => {
    const ev = buildLeadCaptureEvent({
      ctx: baseCtx,
      method: 'newsletter',
      contact_channels: ['email', 'sms'],
      currency: 'EUR',
      value: 299,
    });
    expect(ev).toMatchObject({
      method: 'newsletter',
      contact_channels: ['email', 'sms'],
      currency: 'EUR',
      value: 299,
    });
  });

  it("propage form_mode, step_name, variant_key (smoke test transverse)", () => {
    const ev = buildLeadCaptureEvent({
      ctx: { ...baseCtx, form_mode: 'wizard_cart', variant_key: 'B' },
    });
    expect(ev.form_mode).toBe('wizard_cart');
    expect(ev.variant_key).toBe('B');
  });
});

describe('buildAddressCompletedEvent', () => {
  it('shape minimale (currency défaut MAD, autres champs optionnels omis)', () => {
    const ev = buildAddressCompletedEvent({
      ctx: { ...baseCtx, step_name: 'address' },
    });
    expect(ev).toEqual({
      form_id: 'wizard_kit',
      form_mode: 'wizard_embed',
      step_name: 'address',
      variant_key: 'A',
      lead_id: 'cle_01h0abc',
      schema_version: 'v1',
      currency: DEFAULT_CURRENCY,
    });
  });

  it('shape complète avec items + value + shipping_tier + city_code', () => {
    const items = [
      {
        item_id: 'kit-femiglow',
        item_name: 'Le rituel FemiGlow',
        item_brand: 'FemiGlow',
        price: 299,
        quantity: 1,
        currency: 'MAD',
      },
    ];
    const ev = buildAddressCompletedEvent({
      ctx: { ...baseCtx, step_name: 'address' },
      shipping_tier: 'standard',
      city_code: 'casablanca',
      currency: 'MAD',
      items,
      value: 299,
    });
    expect(ev).toMatchObject({
      shipping_tier: 'standard',
      city_code: 'casablanca',
      items,
      value: 299,
    });
  });
});

describe('buildWizardErrorEvent', () => {
  it('shape erreur de validation client', () => {
    const ev = buildWizardErrorEvent({
      ctx: baseCtx,
      source: 'client_validation',
      error_code: 'PHONE_INVALID',
      field_name: 'phone',
    });
    expect(ev).toMatchObject({
      source: 'client_validation',
      error_code: 'PHONE_INVALID',
      field_name: 'phone',
      schema_version: 'v1',
    });
    expect(ev).not.toHaveProperty('http_status');
  });

  it('shape erreur API avec http_status', () => {
    const ev = buildWizardErrorEvent({
      ctx: baseCtx,
      source: 'api',
      error_code: 'LEAD_RATE_LIMITED',
      http_status: 429,
    });
    expect(ev).toMatchObject({
      source: 'api',
      error_code: 'LEAD_RATE_LIMITED',
      http_status: 429,
    });
  });

  it('accepte les 4 sources (client_validation | api | network | stock)', () => {
    const sources = ['client_validation', 'api', 'network', 'stock'] as const;
    for (const source of sources) {
      const ev = buildWizardErrorEvent({
        ctx: baseCtx,
        source,
        error_code: 'X',
      });
      expect(ev.source).toBe(source);
    }
  });
});

describe('buildWizardAbandonedEvent', () => {
  it('shape minimale (last_field omis si absent)', () => {
    const ev = buildWizardAbandonedEvent({
      ctx: baseCtx,
      last_step_reached: 'address',
      time_on_wizard_ms: 12345,
    });
    expect(ev).toEqual({
      form_id: 'wizard_kit',
      form_mode: 'wizard_embed',
      step_name: 'lead',
      variant_key: 'A',
      lead_id: 'cle_01h0abc',
      schema_version: 'v1',
      last_step_reached: 'address',
      time_on_wizard_ms: 12345,
    });
  });

  it('inclut last_field si fourni', () => {
    const ev = buildWizardAbandonedEvent({
      ctx: baseCtx,
      last_step_reached: 'payment',
      time_on_wizard_ms: 30000,
      last_field: 'city',
    });
    expect(ev.last_field).toBe('city');
  });
});

describe('buildBeginCheckoutEvent', () => {
  it('shape GA4 ecommerce conformity (currency, value, items requis)', () => {
    const items = [
      { item_id: 'kit', item_name: 'Le rituel', price: 299, quantity: 1 },
    ];
    const ev = buildBeginCheckoutEvent({
      ctx: { ...baseCtx, step_name: 'cart_review' },
      value: 299,
      items,
    });
    expect(ev).toMatchObject({
      currency: 'MAD',
      value: 299,
      items,
      step_name: 'cart_review',
    });
  });

  it('coupon optionnel', () => {
    const ev = buildBeginCheckoutEvent({
      ctx: baseCtx,
      value: 299,
      items: [],
      coupon: 'SUMMER10',
    });
    expect(ev.coupon).toBe('SUMMER10');
  });
});

describe('buildAddPaymentInfoEvent', () => {
  it('payment_type requis ; currency par défaut MAD', () => {
    const ev = buildAddPaymentInfoEvent({
      ctx: { ...baseCtx, step_name: 'payment' },
      payment_type: 'cod',
    });
    expect(ev).toMatchObject({
      payment_type: 'cod',
      currency: 'MAD',
      step_name: 'payment',
    });
  });

  it('accepte les 3 payment_type (cod | bank_transfer | card)', () => {
    for (const payment_type of ['cod', 'bank_transfer', 'card'] as const) {
      const ev = buildAddPaymentInfoEvent({
        ctx: baseCtx,
        payment_type,
      });
      expect(ev.payment_type).toBe(payment_type);
    }
  });
});

describe('buildPurchaseEvent', () => {
  it('shape GA4 ecommerce conformity (transaction_id, currency, value, items requis)', () => {
    const items = [
      {
        item_id: 'kit-femiglow',
        item_name: 'Le rituel FemiGlow',
        price: 299,
        quantity: 1,
      },
    ];
    const ev = buildPurchaseEvent({
      ctx: { ...baseCtx, step_name: 'thank_you' },
      transaction_id: 'order_01h0abc',
      value: 299,
      items,
    });
    expect(ev).toMatchObject({
      transaction_id: 'order_01h0abc',
      currency: 'MAD',
      value: 299,
      items,
      schema_version: 'v1',
    });
    // Champs optionnels omis quand non fournis
    expect(ev).not.toHaveProperty('tax');
    expect(ev).not.toHaveProperty('shipping');
    expect(ev).not.toHaveProperty('coupon');
    expect(ev).not.toHaveProperty('payment_type');
  });

  it('inclut tax, shipping, coupon, payment_type quand fournis', () => {
    const ev = buildPurchaseEvent({
      ctx: baseCtx,
      transaction_id: 'order_42',
      value: 350,
      items: [{ item_id: 'kit', item_name: 'Kit', price: 299 }],
      tax: 50,
      shipping: 0,
      coupon: 'WELCOME',
      payment_type: 'bank_transfer',
    });
    expect(ev).toMatchObject({
      tax: 50,
      shipping: 0,
      coupon: 'WELCOME',
      payment_type: 'bank_transfer',
    });
  });
});

describe('Transverse: form_mode et variant_key sur tous les events', () => {
  // Tous les builders du tunnel doivent re-projeter ces 2 champs depuis ctx.
  const variants = [
    { mode: 'wizard_embed', key: 'A' },
    { mode: 'wizard_embed', key: 'B' },
    { mode: 'wizard_cart', key: 'A' },
    { mode: 'wizard_cart', key: null },
    { mode: 'legacy_cart', key: 'control' },
  ] as const;

  for (const { mode, key } of variants) {
    it(`form_mode=${mode} / variant_key=${key} sur lead_capture`, () => {
      const ev = buildLeadCaptureEvent({
        ctx: { ...baseCtx, form_mode: mode, variant_key: key },
      });
      expect(ev.form_mode).toBe(mode);
      expect(ev.variant_key).toBe(key);
    });
  }

  it('schema_version `v1` constant sur tous les builders', () => {
    const allEvents = [
      buildLeadCaptureEvent({ ctx: baseCtx }),
      buildAddressCompletedEvent({ ctx: baseCtx }),
      buildWizardErrorEvent({
        ctx: baseCtx,
        source: 'api',
        error_code: 'X',
      }),
      buildWizardAbandonedEvent({
        ctx: baseCtx,
        last_step_reached: 'lead',
        time_on_wizard_ms: 1,
      }),
      buildBeginCheckoutEvent({ ctx: baseCtx, value: 1, items: [] }),
      buildAddPaymentInfoEvent({ ctx: baseCtx, payment_type: 'cod' }),
      buildPurchaseEvent({
        ctx: baseCtx,
        transaction_id: 'tx',
        value: 1,
        items: [],
      }),
    ];
    for (const ev of allEvents) {
      expect(ev.schema_version).toBe('v1');
    }
  });
});

describe('CHECKOUT_EVENT_NAMES (re-exports)', () => {
  it('expose les noms d\'events stables', () => {
    expect(CHECKOUT_EVENT_NAMES).toEqual({
      leadCapture: 'lead_capture',
      addressCompleted: 'address_completed',
      wizardError: 'wizard_error',
      wizardAbandoned: 'wizard_abandoned',
      beginCheckout: 'begin_checkout',
      addPaymentInfo: 'add_payment_info',
      purchase: 'purchase',
    });
  });
});
