import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { upsertTrackingProvider } from '@/lib/db/queries/tracking/providers';
import { dispatchToProviders } from '@/lib/tracking/server/dispatcher';
import type { DispatchContext } from '@/lib/tracking/providers/types';
import { isFirstPartyOnlyEvent } from './first-party-events';

const GRANTED = {
  ad_storage: 'granted' as const,
  ad_user_data: 'granted' as const,
  ad_personalization: 'granted' as const,
  analytics_storage: 'granted' as const,
  functional_storage: 'granted' as const,
  security_storage: 'granted' as const,
};

function ctx(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    eventName: 'web_vitals',
    eventId: 'e_vitals_1',
    receivedAt: new Date('2026-10-30T12:00:00Z'),
    pageRoute: '/kit',
    pageUrl: 'https://femiglow-maroc.com/kit',
    anonymousId: 'v_test',
    sessionId: 's_test',
    consent: GRANTED,
    uaHash: 'uahash',
    ipAnonymized: '0.0.0.0',
    device: 'mobile',
    locale: 'fr',
    params: { name: 'LCP', value: 2100, page_route: '/kit', sample_rate: 1 },
    ...overrides,
  };
}

describe('isFirstPartyOnlyEvent', () => {
  it('web_vitals est first-party uniquement', () => {
    expect(isFirstPartyOnlyEvent('web_vitals')).toBe(true);
    expect(isFirstPartyOnlyEvent('purchase')).toBe(false);
    expect(isFirstPartyOnlyEvent('page_view')).toBe(false);
  });
});

describe('dispatchToProviders × web_vitals', () => {
  beforeEach(() => {
    resetMemoryStore();
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;
  });

  it('n’appelle aucun provider (Meta, TikTok, GTM, custom…) même tous activés', async () => {
    for (const kind of ['meta', 'tiktok', 'google_ads', 'google_ga4', 'gtm', 'custom'] as const) {
      await upsertTrackingProvider({
        kind,
        status: 'enabled',
        pixelId: `px_${kind}`,
        capiToken: `tok_${kind}`,
      });
    }
    // Témoin : le même contexte en `purchase` atteint bien les providers.
    const control = await dispatchToProviders(
      ctx({ eventName: 'purchase', params: { transaction_id: 'o_1', value: 199, currency: 'MAD' } }),
    );
    expect(Object.keys(control.results).length).toBeGreaterThan(0);
    vi.mocked(globalThis.fetch).mockClear();

    const outcome = await dispatchToProviders(ctx());
    expect(outcome).toEqual({ dispatched: [], results: {} });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
