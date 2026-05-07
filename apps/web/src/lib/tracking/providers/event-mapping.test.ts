import { describe, expect, it } from 'vitest';
import { isEventSupported, mapEventName } from './event-mapping';

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
});
