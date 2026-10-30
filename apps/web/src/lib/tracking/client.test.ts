import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TrackingClient } from './client';
import { getDataLayer } from './datalayer';
import type { TrackingConsentState } from '@/lib/db/types';

const GRANTED: TrackingConsentState = {
  ad_storage: 'granted',
  analytics_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  functional_storage: 'granted',
};

function buildClient(): TrackingClient {
  return new TrackingClient({
    consent: () => GRANTED,
    user: () => ({ anonymous_id: 'anon_1', session_id: 'sess_1' }),
    page: () => ({
      url: 'https://example.test/kit',
      path: '/kit',
      title: 'Kit',
      referrer: '',
      locale: 'fr-MA',
    }),
  });
}

beforeEach(() => {
  // Reset the dataLayer between tests — both window.dataLayer (legacy GTM)
  // and the module-singleton entries array (via flush()).
  getDataLayer().flush();
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = [];
});

describe('TrackingClient.emit — eventIdOverride', () => {
  it('uses a uuidv7-shaped event_id when no override is provided', () => {
    const client = buildClient();
    client.emit('view_item', { value: 320, currency: 'MAD' });
    const dl = getDataLayer().entries;
    expect(dl).toHaveLength(1);
    expect(dl[0]!.event_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('uses the override verbatim when it is a 32-hex string (deriveEventId format)', () => {
    const client = buildClient();
    const seed = 'a'.repeat(32);
    client.emit('view_item', { value: 320, currency: 'MAD' }, { eventIdOverride: seed });
    const dl = getDataLayer().entries;
    expect(dl).toHaveLength(1);
    expect(dl[0]!.event_id).toBe(seed);
  });

  it('uses the override verbatim when it is a uuid v7 (36 chars)', () => {
    const client = buildClient();
    const uuid = '01923bcd-1234-7890-9abc-def012345678';
    client.emit('view_item', { value: 320, currency: 'MAD' }, { eventIdOverride: uuid });
    expect(getDataLayer().entries[0]!.event_id).toBe(uuid);
  });

  it('falls back to uuidv7 when the override is malformed', () => {
    const client = buildClient();
    client.emit(
      'view_item',
      { value: 320, currency: 'MAD' },
      { eventIdOverride: 'NOT_A_VALID_ID' },
    );
    const id = getDataLayer().entries[0]!.event_id;
    // Pas l'override, mais une vraie uuid v7.
    expect(id).not.toBe('NOT_A_VALID_ID');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('falls back to uuidv7 when the override is too short', () => {
    const client = buildClient();
    client.emit(
      'view_item',
      { value: 320, currency: 'MAD' },
      { eventIdOverride: 'abc123' },
    );
    expect(getDataLayer().entries[0]!.event_id).not.toBe('abc123');
  });

  it('shares the same event_id across two emits if both pass the same override', () => {
    const client = buildClient();
    const seed = 'b'.repeat(32);
    client.emit('view_item', { value: 320, currency: 'MAD' }, { eventIdOverride: seed });
    // Override the redundancy window to allow second emit
    client.emit(
      'add_to_cart',
      { value: 320, currency: 'MAD' },
      { eventIdOverride: seed, dedupKey: 'distinct' },
    );
    const dl = getDataLayer().entries;
    expect(dl).toHaveLength(1); // second emit dedup-rejected by event_id cache
    expect(dl[0]!.event_id).toBe(seed);
  });
});

describe('TrackingClient.emit — legacy contract (regression)', () => {
  it('pushes to dataLayer with required fields', () => {
    const client = buildClient();
    client.emit('view_item', { value: 320, currency: 'MAD' });
    const entry = getDataLayer().entries[0]!;
    expect(entry).toMatchObject({
      event: 'view_item',
      schema_version: 1,
      consent: GRANTED,
      page: { path: '/kit' },
      user: { anonymous_id: 'anon_1', session_id: 'sess_1' },
      params: { value: 320, currency: 'MAD' },
    });
  });

  it('respects redundancy windows (view_item 30s default)', () => {
    const client = buildClient();
    client.emit('view_item', { item_id: 'kit', value: 320, currency: 'MAD' });
    client.emit('view_item', { item_id: 'kit', value: 320, currency: 'MAD' });
    expect(getDataLayer().entries).toHaveLength(1);
  });
});

describe('TrackingClient.emit — événements first-party (kit_checkout_exposure, web_vitals)', () => {
  it('jamais poussés dans le dataLayer (GTM, pixels), mais envoyés à /api/track', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    const originalFetch = globalThis.fetch;
    const originalBeacon = navigator.sendBeacon;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    const pushed = vi.fn();
    window.addEventListener('fg:datalayer-push', pushed);
    try {
      const client = buildClient();
      client.emit('kit_checkout_exposure', {
        assigned_mode: 'sheet',
        mode_source: 'ab',
        cms_mode: 'ab',
        share_pct: 50,
      });
      expect(getDataLayer().entries).toHaveLength(0);
      expect((window as unknown as { dataLayer: unknown[] }).dataLayer).toHaveLength(0);
      expect(pushed).not.toHaveBeenCalled();

      await client.flush();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [endpoint, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
      expect(endpoint).toBe('/api/track');
      const body = JSON.parse(String(init.body)) as { events: Array<{ event: string; params: unknown }> };
      expect(body.events.map((e) => e.event)).toEqual(['kit_checkout_exposure']);
      expect(body.events[0]!.params).toMatchObject({ assigned_mode: 'sheet', mode_source: 'ab' });

      // Témoin : un événement ordinaire passe bien par le dataLayer.
      client.emit('view_item', { value: 320, currency: 'MAD' });
      expect(getDataLayer().entries.map((e) => e.event)).toEqual(['view_item']);
    } finally {
      window.removeEventListener('fg:datalayer-push', pushed);
      globalThis.fetch = originalFetch;
      Object.defineProperty(navigator, 'sendBeacon', { value: originalBeacon, configurable: true });
    }
  });
});
