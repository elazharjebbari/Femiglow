import { describe, expect, it } from 'vitest';
import {
  getAdsConversionLabelKey,
  getAttributionMode,
  getEventIdentityFields,
  getEventMapping,
  isEventSupported,
  listAdsConversionEvents,
  listAdsConversions,
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
    it('lead_capture → conversion routée Meta=Lead, Ads=generate_lead, Snap=SIGN_UP, GA4=lead_capture', () => {
      expect(mapEventName('lead_capture', 'google_ga4')).toBe('lead_capture');
      expect(mapEventName('lead_capture', 'meta')).toBe('Lead');
      expect(mapEventName('lead_capture', 'google_ads')).toBe('generate_lead');
      expect(mapEventName('lead_capture', 'snap')).toBe('SIGN_UP');
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

  describe('mapping étendu (categories + roles + groups)', () => {
    it('purchase a la catégorie PURCHASE, primary, group sales', () => {
      const m = getEventMapping('purchase');
      expect(m?.google_ads?.category).toBe('PURCHASE');
      expect(m?.google_ads?.recommendedRole).toBe('primary');
      expect(m?.google_ads?.group).toBe('sales');
    });

    it('lead_capture / generate_lead / chat_lead_form_submit → SUBMIT_LEAD_FORM primary leads', () => {
      for (const k of ['lead_capture', 'generate_lead', 'chat_lead_form_submit']) {
        const m = getEventMapping(k);
        expect(m?.google_ads?.category).toBe('SUBMIT_LEAD_FORM');
        expect(m?.google_ads?.recommendedRole).toBe('primary');
        expect(m?.google_ads?.group).toBe('leads');
        expect(m?.google_ads?.conversionLabelKey).toBe('lead');
      }
    });

    it('sign_up → SIGNUP secondary leads (match Google Ads UI Secondaire)', () => {
      const m = getEventMapping('sign_up');
      expect(m?.google_ads?.category).toBe('SIGNUP');
      // sign_up est SECONDAIRE dans la config Google Ads UI. Le mapping
      // reflète cette source de vérité — broadcast pour alimenter
      // smart bidding (cf. getAttributionMode).
      expect(m?.google_ads?.recommendedRole).toBe('secondary');
    });

    it('contact_submit → CONTACT primary leads', () => {
      const m = getEventMapping('contact_submit');
      expect(m?.google_ads?.category).toBe('CONTACT');
      expect(m?.google_ads?.recommendedRole).toBe('primary');
    });

    it('newsletter_submit → SIGNUP secondary (volume élevé, intent faible)', () => {
      const m = getEventMapping('newsletter_submit');
      expect(m?.google_ads?.category).toBe('SIGNUP');
      expect(m?.google_ads?.recommendedRole).toBe('secondary');
    });

    it('chat_widget_open → engagement (further secondary), chat_message_sent → CONTACT primary (match Google Ads UI)', () => {
      expect(getEventMapping('chat_widget_open')?.google_ads?.group).toBe('further');
      expect(getEventMapping('chat_message_sent')?.google_ads?.category).toBe('CONTACT');
      // chat_message_sent est PRINCIPALE dans la config Google Ads UI
      // (groupe "Envoi de formulaire de lead"). Le mapping reflète
      // désormais cette source de vérité pour piloter le gating
      // attribution (cf. getAttributionMode).
      expect(getEventMapping('chat_message_sent')?.google_ads?.recommendedRole).toBe('primary');
    });

    it('file_download / video_complete / fg_journal_read_100 → DEFAULT secondary further', () => {
      for (const k of ['file_download', 'video_complete', 'fg_journal_read_100']) {
        const m = getEventMapping(k);
        expect(m?.google_ads?.category).toBe('DEFAULT');
        expect(m?.google_ads?.recommendedRole).toBe('secondary');
        expect(m?.google_ads?.group).toBe('further');
      }
    });
  });

  describe('listAdsConversions() — dédupliqué et ordonné', () => {
    it('ne contient qu\'une entrée par conversionLabelKey, avec events agrégés', () => {
      const list = listAdsConversions();
      const keys = list.map((c) => c.conversionLabelKey);
      // Pas de doublon
      expect(new Set(keys).size).toBe(keys.length);

      // La conv "lead" agrège lead_capture + generate_lead + chat_lead_form_submit
      const lead = list.find((c) => c.conversionLabelKey === 'lead');
      expect(lead).toBeDefined();
      expect(lead!.events).toEqual(
        expect.arrayContaining(['lead_capture', 'generate_lead', 'chat_lead_form_submit']),
      );
    });

    it('ordre : sales avant leads avant further ; primary avant secondary', () => {
      const list = listAdsConversions();
      const positionOf = (key: string) => list.findIndex((c) => c.conversionLabelKey === key);
      // purchase (sales primary) avant lead (leads primary)
      expect(positionOf('purchase')).toBeLessThan(positionOf('lead'));
      // lead (leads primary) avant chat_engagement (further secondary)
      expect(positionOf('lead')).toBeLessThan(positionOf('chat_engagement'));
      // Dans sales : purchase (primary) avant add_to_cart (secondary)
      expect(positionOf('purchase')).toBeLessThan(positionOf('add_to_cart'));
    });

    it('inclut toutes les nouvelles conv (sign_up, contact, newsletter, chat_*, download, video_complete, journal_read)', () => {
      const keys = listAdsConversions().map((c) => c.conversionLabelKey);
      for (const k of [
        'purchase',
        'add_to_cart',
        'checkout_intent',
        'lead',
        'sign_up',
        'contact',
        'newsletter',
        'chat_engagement',
        'chat_contact',
        'download',
        'video_complete',
        'journal_read',
      ]) {
        expect(keys).toContain(k);
      }
    });
  });

  describe('getAttributionMode (gating per-provider)', () => {
    describe('Google Ads — primary/secondary depuis recommendedRole', () => {
      it.each([
        ['purchase', 'primary'],
        ['generate_lead', 'primary'],
        ['lead_capture', 'primary'],
        ['contact_submit', 'primary'],
        ['chat_lead_form_submit', 'primary'],
        ['chat_message_sent', 'primary'],
      ])('%s → primary (attribution-gated)', (key, expected) => {
        expect(getAttributionMode(key, 'google_ads')).toBe(expected);
      });

      it.each([
        ['add_to_cart', 'broadcast'],
        ['checkout_intent', 'broadcast'],
        ['begin_checkout', 'broadcast'],
        ['sign_up', 'broadcast'],
        ['newsletter_submit', 'broadcast'],
        ['video_complete', 'broadcast'],
        ['file_download', 'broadcast'],
        ['fg_journal_read_100', 'broadcast'],
        ['chat_widget_open', 'broadcast'],
      ])('%s → broadcast (secondary, alimente Smart Bidding)', (key, expected) => {
        expect(getAttributionMode(key, 'google_ads')).toBe(expected);
      });
    });

    describe('Meta — primary uniquement pour Purchase et Lead', () => {
      it.each([
        ['purchase', 'primary'], // → Purchase
        ['generate_lead', 'primary'], // → Lead
        ['lead_capture', 'primary'], // → Lead
        ['chat_lead_form_submit', 'primary'], // → Lead
      ])('%s → primary (gated pour Meta CAPI)', (key, expected) => {
        expect(getAttributionMode(key, 'meta')).toBe(expected);
      });

      it.each([
        ['view_item', 'broadcast'], // → ViewContent
        ['add_to_cart', 'broadcast'], // → AddToCart
        ['checkout_intent', 'broadcast'], // → InitiateCheckout
        ['begin_checkout', 'broadcast'], // → InitiateCheckout
        ['add_payment_info', 'broadcast'], // → AddPaymentInfo
        ['sign_up', 'broadcast'], // → CompleteRegistration
        ['chat_message_sent', 'broadcast'], // → Contact
      ])('%s → broadcast (intent/funnel/audience Meta)', (key, expected) => {
        expect(getAttributionMode(key, 'meta')).toBe(expected);
      });
    });

    describe('TikTok — primary pour CompletePayment et SubmitForm', () => {
      it('purchase → primary (CompletePayment)', () => {
        expect(getAttributionMode('purchase', 'tiktok')).toBe('primary');
      });
      it('generate_lead → primary (SubmitForm)', () => {
        expect(getAttributionMode('generate_lead', 'tiktok')).toBe('primary');
      });
      it('view_item → broadcast (ViewContent)', () => {
        expect(getAttributionMode('view_item', 'tiktok')).toBe('broadcast');
      });
      it('checkout_intent → broadcast (InitiateCheckout)', () => {
        expect(getAttributionMode('checkout_intent', 'tiktok')).toBe('broadcast');
      });
    });

    describe('Snap — primary pour PURCHASE et SIGN_UP', () => {
      it('purchase → primary', () => {
        expect(getAttributionMode('purchase', 'snap')).toBe('primary');
      });
      it('lead_capture → primary', () => {
        expect(getAttributionMode('lead_capture', 'snap')).toBe('primary');
      });
      it('chat_lead_form_submit → primary via SIGN_UP', () => {
        expect(mapEventName('chat_lead_form_submit', 'snap')).toBe('SIGN_UP');
        expect(getAttributionMode('chat_lead_form_submit', 'snap')).toBe('primary');
      });
      it('checkout_intent → broadcast', () => {
        expect(getAttributionMode('checkout_intent', 'snap')).toBe('broadcast');
      });
    });

    it('event inconnu → broadcast (safety default)', () => {
      expect(getAttributionMode('definitely_unknown_event', 'meta')).toBe('broadcast');
      expect(getAttributionMode('definitely_unknown_event', 'google_ads')).toBe('broadcast');
      expect(getAttributionMode('definitely_unknown_event', 'tiktok')).toBe('broadcast');
      expect(getAttributionMode('definitely_unknown_event', 'snap')).toBe('broadcast');
    });
  });
});
