/**
 * @vitest-environment jsdom
 *
 * Tests d'intégration : TrackingClient.emit() annote correctement le
 * dataLayer avec le bloc `attribution`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackingClient } from './client';
import { getDataLayer } from './datalayer';
import {
  ATTR_COOKIE_NAME,
  mergeTouch,
  writeAttributionCookie,
} from './attribution/cookie';
import type { ChannelTouch } from './attribution/types';

const GRANTED = {
  ad_storage: 'granted' as const,
  ad_user_data: 'granted' as const,
  ad_personalization: 'granted' as const,
  analytics_storage: 'granted' as const,
  functional_storage: 'granted' as const,
  security_storage: 'granted' as const,
};

function makeClient(strategy?: () => 'last_paid_touch' | 'first_paid_touch' | 'broadcast') {
  return new TrackingClient({
    consent: () => GRANTED,
    user: () => ({ anonymous_id: 'v_test', session_id: 's_test' }),
    page: () => ({
      url: 'https://test/',
      path: '/',
      title: '',
      referrer: '',
      locale: 'fr-MA',
    }),
    endpoint: '/api/track',
    attributionStrategy: strategy ?? (() => 'last_paid_touch'),
  });
}

function touch(overrides: Partial<ChannelTouch> = {}): ChannelTouch {
  return {
    channel: 'direct',
    is_paid: false,
    detected_at: '2026-05-15T12:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  document.cookie = `${ATTR_COOKIE_NAME}=; Max-Age=0; Path=/`;
  getDataLayer().flush();
  // sendBeacon n'existe pas en jsdom → on disable la queue side
  Object.defineProperty(navigator, 'sendBeacon', { value: () => true, configurable: true });
});

afterEach(() => {
  document.cookie = `${ATTR_COOKIE_NAME}=; Max-Age=0; Path=/`;
  getDataLayer().flush();
  vi.restoreAllMocks();
});

describe('TrackingClient.emit() — attribution annotation', () => {
  it('sans cookie → attribution.channel = direct (last_paid_touch sans historique)', () => {
    const client = makeClient();
    client.emit('purchase', { value: 199 });
    const entries = getDataLayer().entries;
    expect(entries).toHaveLength(1);
    const attr = entries[0]?.attribution;
    expect(attr).toBeDefined();
    expect(attr?.channel).toBe('direct');
    expect(attr?.is_paid).toBe(false);
    expect(attr?.strategy).toBe('last_paid_touch');
  });

  it('cookie avec paid_history meta → channel = meta', () => {
    writeAttributionCookie({
      first_touch: touch({ channel: 'meta', is_paid: true, click_id: 'fb1', click_id_field: 'fbclid' }),
      last_touch: touch({ channel: 'direct' }),
      paid_history: [touch({ channel: 'meta', is_paid: true, click_id: 'fb1', click_id_field: 'fbclid' })],
    });
    const client = makeClient();
    client.emit('purchase', {});
    const attr = getDataLayer().entries[0]?.attribution;
    expect(attr?.channel).toBe('meta');
    expect(attr?.is_paid).toBe(true);
    expect(attr?.click_id).toBe('fb1');
    expect(attr?.click_id_field).toBe('fbclid');
  });

  it('stratégie broadcast → channel = broadcast', () => {
    const client = makeClient(() => 'broadcast');
    client.emit('purchase', {});
    expect(getDataLayer().entries[0]?.attribution?.channel).toBe('broadcast');
  });

  it('paid_history avec google_ads + meta → last_paid_touch = google_ads (prepend)', () => {
    const adsTouch = touch({ channel: 'google_ads', is_paid: true, click_id: 'g1', click_id_field: 'gclid' });
    const metaTouch = touch({ channel: 'meta', is_paid: true, click_id: 'f1', click_id_field: 'fbclid' });
    // L'utilisateur a cliqué Meta, puis Google → google_ads est le LAST paid
    let snap = { first_touch: metaTouch, last_touch: metaTouch, paid_history: [metaTouch] };
    snap = mergeTouch(snap, adsTouch);
    writeAttributionCookie(snap);
    const client = makeClient();
    client.emit('purchase', {});
    expect(getDataLayer().entries[0]?.attribution?.channel).toBe('google_ads');
  });

  it('first_paid_touch retrouve la première touche payante (la plus ancienne)', () => {
    const adsTouch = touch({ channel: 'google_ads', is_paid: true, click_id: 'g1' });
    const metaTouch = touch({ channel: 'meta', is_paid: true, click_id: 'f1' });
    let snap = { first_touch: metaTouch, last_touch: metaTouch, paid_history: [metaTouch] };
    snap = mergeTouch(snap, adsTouch); // ads = plus récent, meta = plus ancien
    writeAttributionCookie(snap);
    const client = makeClient(() => 'first_paid_touch');
    client.emit('purchase', {});
    expect(getDataLayer().entries[0]?.attribution?.channel).toBe('meta');
  });

  it('reason est renseigné pour debug', () => {
    writeAttributionCookie({
      first_touch: touch({ channel: 'meta', is_paid: true, click_id_field: 'fbclid' }),
      last_touch: touch({ channel: 'meta', is_paid: true, click_id_field: 'fbclid' }),
      paid_history: [touch({ channel: 'meta', is_paid: true, click_id_field: 'fbclid' })],
    });
    const client = makeClient();
    client.emit('lead_capture', {});
    expect(getDataLayer().entries[0]?.attribution?.reason).toContain('last_paid_touch');
    expect(getDataLayer().entries[0]?.attribution?.reason).toContain('fbclid');
  });
});
