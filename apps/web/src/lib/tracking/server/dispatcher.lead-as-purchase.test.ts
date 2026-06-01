/**
 * Intégration : `dispatchToProviders` × pont lead→Meta Purchase (flag ON).
 * Audit meta-lead-as-purchase-2026-06-01.
 *
 * Vérifie : (1) un lead chat/panier part en Meta `Purchase` (CAPI), non gaté ;
 * (2) un `purchase` qui suit le même visiteur est SUPPRIMÉ côté Meta ;
 * (3) un `purchase` sans lead préalable part normalement.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Flag ON : on charge le vrai env (defaults valides) puis on force le flag.
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return {
    ...actual,
    env: { ...actual.env, META_LEAD_AS_PURCHASE_ENABLED: 'true' },
  };
});

import { resetMemoryStore } from '@/lib/db/client';
import { upsertTrackingProvider } from '@/lib/db/queries/tracking/providers';
import type { DispatchContext } from '@/lib/tracking/providers/types';
import { dispatchToProviders } from './dispatcher';
import {
  deriveMetaPurchaseJourneyId,
  __clearLeadAsPurchaseLedger,
} from './lead-as-purchase';

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
    eventName: 'purchase',
    eventId: 'e_test_1',
    receivedAt: new Date(),
    pageRoute: '/kit',
    pageUrl: 'https://femiglow-maroc.com/kit',
    anonymousId: 'v_test',
    sessionId: 's_test',
    consent: GRANTED,
    uaHash: 'uahash',
    ipAnonymized: '0.0.0.0',
    device: 'mobile',
    locale: 'fr-MA',
    params: { value: 199, currency: 'MAD' },
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  resetMemoryStore();
  __clearLeadAsPurchaseLedger();
  fetchMock = vi.fn(
    async () => new Response(JSON.stringify({ events_received: 1 }), { status: 200 }),
  );
  globalThis.fetch = fetchMock as never;
  await upsertTrackingProvider({ kind: 'meta', status: 'enabled', pixelId: '111', capiToken: 'tok_meta' });
});

/** Extrait le payload CAPI Meta (data[0]) du dernier fetch graph.facebook.com. */
function lastMetaPayload(): Record<string, unknown> | null {
  for (let i = fetchMock.mock.calls.length - 1; i >= 0; i -= 1) {
    const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit | undefined];
    if (typeof url === 'string' && url.includes('facebook.com') && init?.body) {
      const body = JSON.parse(String(init.body)) as { data?: Array<Record<string, unknown>> };
      return body.data?.[0] ?? null;
    }
  }
  return null;
}

describe('dispatchToProviders × lead→Meta Purchase (flag ON)', () => {
  it('lead chat (generate_lead, method=chat) → Meta dispatched comme Purchase', async () => {
    const out = await dispatchToProviders(
      ctx({ eventName: 'generate_lead', anonymousId: 'v_lead', params: { method: 'chat', value: 199, currency: 'MAD' } }),
    );
    expect(out.results.meta?.status).toBe('sent');
    const payload = lastMetaPayload();
    expect(payload?.event_name).toBe('Purchase'); // override lead→Purchase
    expect(payload?.event_id).toBe(deriveMetaPurchaseJourneyId('v_lead')); // event_id de parcours
  });

  it('purchase APRÈS lead (même visiteur) → Meta SUPPRIMÉ', async () => {
    await dispatchToProviders(
      ctx({ eventName: 'generate_lead', anonymousId: 'v_dup', params: { method: 'chat', value: 199, currency: 'MAD' } }),
    );
    const out = await dispatchToProviders(ctx({ eventName: 'purchase', anonymousId: 'v_dup' }));
    expect(out.results.meta?.status).toBe('skipped');
    expect(out.results.meta?.error).toContain('lead_as_purchase_suppress');
  });

  it('purchase SANS lead préalable → Meta dispatched normalement', async () => {
    const out = await dispatchToProviders(ctx({ eventName: 'purchase', anonymousId: 'v_solo' }));
    expect(out.results.meta?.status).toBe('sent');
    const payload = lastMetaPayload();
    expect(payload?.event_name).toBe('Purchase');
  });

  it('lead newsletter (non éligible) → PAS de Meta Purchase override', async () => {
    const out = await dispatchToProviders(
      ctx({ eventName: 'generate_lead', anonymousId: 'v_news', params: { method: 'newsletter', value: 0 } }),
    );
    // generate_lead → Meta 'Lead' (mapping normal), pas 'Purchase'.
    if (out.results.meta?.status === 'sent') {
      expect(lastMetaPayload()?.event_name).toBe('Lead');
    }
  });
});
