import { describe, expect, it } from 'vitest';
import {
  getAdsConversionLabelKey,
  getEventIdentityFields,
  getEventMapping,
  isEventSupported,
  listAdsConversionEvents,
  mapEventName,
} from './event-mapping';

describe('event-mapping', () => {
  it('purchase → noms canoniques par provider', () => {
    expect(mapEventName('purchase', 'meta')).toBe('Purchase');
    expect(mapEventName('purchase', 'google_ga4')).toBe('purchase');
    expect(mapEventName('purchase', 'tiktok')).toBe('CompletePayment');
    expect(mapEventName('purchase', 'snap')).toBe('PURCHASE');
    expect(mapEventName('purchase', 'pinterest')).toBe('checkout');
  });

  it('add_to_cart pour Meta = AddToCart', () => {
    expect(mapEventName('add_to_cart', 'meta')).toBe('AddToCart');
  });

  it('event inconnu → null pour tous providers', () => {
    expect(mapEventName('definitely_unknown', 'meta')).toBeNull();
    expect(mapEventName('definitely_unknown', 'google_ga4')).toBeNull();
  });

  it('event sans mapping pour un provider donné → null', () => {
    expect(mapEventName('scroll_depth', 'meta')).toBeNull();
  });

  it('isEventSupported reflète mapEventName', () => {
    expect(isEventSupported('purchase', 'meta')).toBe(true);
    expect(isEventSupported('scroll_depth', 'meta')).toBe(false);
  });

  it('google_ads fallback sur google_ga4 si pas de mapping spécifique', () => {
    expect(mapEventName('view_item', 'google_ads')).toBe('view_item');
  });

  // CHA-230 — Wizard checkout funnel events
  describe('CHA-230 wizard events', () => {
    it('lead_capture → conversion routée Meta=Lead, Ads=generate_lead, GA4=lead_capture', () => {
      expect(mapEventName('lead_capture', 'google_ga4')).toBe('lead_capture');
      expect(mapEventName('lead_capture', 'meta')).toBe('Lead');
      expect(mapEventName('lead_capture', 'google_ads')).toBe('generate_lead');
    });

    it('address_completed → GA4 add_shipping_info (réutilise rapports Enhanced Ecommerce)', () => {
      expect(mapEventName('address_completed', 'google_ga4')).toBe('add_shipping_info');
      expect(mapEventName('address_completed', 'meta')).toBeNull();
    });

    it('wizard_error et wizard_abandoned → GA4 only (signaux internes)', () => {
      expect(mapEventName('wizard_error', 'google_ga4')).toBe('wizard_error');
      expect(mapEventName('wizard_abandoned', 'google_ga4')).toBe('wizard_abandoned');
      expect(mapEventName('wizard_error', 'meta')).toBeNull();
      expect(mapEventName('wizard_abandoned', 'meta')).toBeNull();
    });

    it('isEventSupported reflète les mappings wizard', () => {
      expect(isEventSupported('lead_capture', 'meta')).toBe(true);
      expect(isEventSupported('wizard_error', 'meta')).toBe(false);
    });
  });

  describe('schéma enrichi (conversion labels + identity)', () => {
    it('getEventMapping renvoie la structure complète', () => {
      const m = getEventMapping('purchase');
      expect(m?.meta).toMatchObject({ name: 'Purchase', isStandard: true });
      expect(m?.google_ads).toMatchObject({
        name: 'purchase',
        conversionLabelKey: 'purchase',
      });
    });

    it('checkout_intent : InitiateCheckout (Meta std) + Ads conversion', () => {
      const m = getEventMapping('checkout_intent');
      expect(m?.meta).toMatchObject({ name: 'InitiateCheckout', isStandard: true });
      expect(m?.google_ga4?.name).toBe('begin_checkout');
      expect(m?.google_ads?.conversionLabelKey).toBe('checkout_intent');
    });

    it('getAdsConversionLabelKey renvoie la clé pour les conversions Ads', () => {
      expect(getAdsConversionLabelKey('purchase')).toBe('purchase');
      expect(getAdsConversionLabelKey('checkout_intent')).toBe('checkout_intent');
      expect(getAdsConversionLabelKey('lead_capture')).toBe('lead');
      expect(getAdsConversionLabelKey('add_to_cart')).toBe('add_to_cart');
      expect(getAdsConversionLabelKey('page_view')).toBeNull();
      expect(getAdsConversionLabelKey('does_not_exist')).toBeNull();
    });

    it('getEventIdentityFields renvoie la liste des champs à hash', () => {
      expect(getEventIdentityFields('purchase')).toEqual(
        expect.arrayContaining(['email', 'phone', 'firstName', 'lastName', 'city', 'country']),
      );
      expect(getEventIdentityFields('lead_capture')).toEqual(
        expect.arrayContaining(['phone', 'firstName']),
      );
      expect(getEventIdentityFields('page_view')).toEqual([]);
      expect(getEventIdentityFields('checkout_intent')).toEqual([]);
    });

    it('listAdsConversionEvents enumère les events avec conversionLabelKey', () => {
      const list = listAdsConversionEvents();
      const keys = list.map((c) => c.conversionLabelKey);
      expect(keys).toContain('purchase');
      expect(keys).toContain('checkout_intent');
      expect(keys).toContain('lead');
      expect(list.find((c) => c.eventName === 'page_view')).toBeUndefined();
    });
  });
});
