import { describe, expect, it } from 'vitest';

import {
  mapEventName,
  listSupportedEvents,
  listSkippedEvents,
} from './event-mapper';

describe('mapEventName — Meta', () => {
  it('view_item → ViewContent', () => {
    const r = mapEventName('view_item', 'meta');
    expect(r.name).toBe('ViewContent');
    expect(r.skip).toBe(false);
    expect(r.mapped).toBe(true);
  });

  it('purchase → Purchase', () => {
    expect(mapEventName('purchase', 'meta').name).toBe('Purchase');
  });

  it('add_to_cart → AddToCart', () => {
    expect(mapEventName('add_to_cart', 'meta').name).toBe('AddToCart');
  });

  it('begin_checkout → InitiateCheckout', () => {
    expect(mapEventName('begin_checkout', 'meta').name).toBe('InitiateCheckout');
  });

  it('generate_lead → Lead', () => {
    expect(mapEventName('generate_lead', 'meta').name).toBe('Lead');
  });

  it('scroll_depth → skip', () => {
    const r = mapEventName('scroll_depth', 'meta');
    expect(r.skip).toBe(true);
    expect(r.mapped).toBe(true);
    expect(r.name).toBe(null);
  });

  it('event inconnu → skip + mapped=false (fallback drop)', () => {
    const r = mapEventName('random_event_xyz', 'meta');
    expect(r.skip).toBe(true);
    expect(r.mapped).toBe(false);
  });
});

describe('mapEventName — GA4 (as-is)', () => {
  it('view_item → view_item (as-is)', () => {
    expect(mapEventName('view_item', 'ga4').name).toBe('view_item');
  });

  it('purchase → purchase', () => {
    expect(mapEventName('purchase', 'ga4').name).toBe('purchase');
  });

  it('scroll_depth → scroll_depth (as-is, GA4 accepte les customs)', () => {
    expect(mapEventName('scroll_depth', 'ga4').name).toBe('scroll_depth');
  });
});

describe('mapEventName — TikTok', () => {
  it('view_item → ViewContent', () => {
    expect(mapEventName('view_item', 'tiktok').name).toBe('ViewContent');
  });

  it('purchase → CompletePayment (TikTok ne dit pas Purchase)', () => {
    expect(mapEventName('purchase', 'tiktok').name).toBe('CompletePayment');
  });

  it('generate_lead → CompleteRegistration (closest approx)', () => {
    expect(mapEventName('generate_lead', 'tiktok').name).toBe('CompleteRegistration');
  });

  it('scroll_depth → skip', () => {
    expect(mapEventName('scroll_depth', 'tiktok').skip).toBe(true);
  });
});

describe('mapEventName — Snap', () => {
  it('view_item → VIEW_CONTENT (uppercase Snap convention)', () => {
    expect(mapEventName('view_item', 'snap').name).toBe('VIEW_CONTENT');
  });

  it('purchase → PURCHASE', () => {
    expect(mapEventName('purchase', 'snap').name).toBe('PURCHASE');
  });

  it('generate_lead → SIGN_UP', () => {
    expect(mapEventName('generate_lead', 'snap').name).toBe('SIGN_UP');
  });
});

describe('mapEventName — Pinterest', () => {
  it('view_item → pagevisit', () => {
    expect(mapEventName('view_item', 'pinterest').name).toBe('pagevisit');
  });

  it('purchase → checkout', () => {
    expect(mapEventName('purchase', 'pinterest').name).toBe('checkout');
  });

  it('generate_lead → lead', () => {
    expect(mapEventName('generate_lead', 'pinterest').name).toBe('lead');
  });
});

describe('mapEventName — Google Ads', () => {
  it('purchase → conversion (uniform name pour Google Ads)', () => {
    expect(mapEventName('purchase', 'google_ads').name).toBe('conversion');
  });

  it('generate_lead → conversion', () => {
    expect(mapEventName('generate_lead', 'google_ads').name).toBe('conversion');
  });

  it('view_item → non mappé (Google Ads ne tracke pas les vues simples)', () => {
    const r = mapEventName('view_item', 'google_ads');
    expect(r.skip).toBe(true);
    expect(r.mapped).toBe(false);
  });
});

describe('listSupportedEvents', () => {
  it('Meta liste contient les events e-commerce principaux', () => {
    const events = listSupportedEvents('meta');
    expect(events).toContain('view_item');
    expect(events).toContain('purchase');
    expect(events).toContain('generate_lead');
    expect(events).toContain('add_to_cart');
  });

  it('GA4 contient page_view (ce que les autres ne supportent pas)', () => {
    expect(listSupportedEvents('ga4')).toContain('page_view');
  });

  it('listSupportedEvents n\'inclut PAS les events skip', () => {
    const meta = listSupportedEvents('meta');
    expect(meta).not.toContain('scroll_depth'); // skip Meta
  });
});

describe('listSkippedEvents', () => {
  it('Meta skip scroll_depth, click, share', () => {
    const skipped = listSkippedEvents('meta');
    expect(skipped).toContain('scroll_depth');
    expect(skipped).toContain('click');
    expect(skipped).toContain('share');
  });
});

describe('mapEventName — déterminisme', () => {
  it('même input → même output', () => {
    expect(mapEventName('view_item', 'meta')).toEqual(mapEventName('view_item', 'meta'));
  });
});
