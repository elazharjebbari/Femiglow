/**
 * Sanity tests pour les MSW handlers tracking-providers.
 *
 * Vérifie que :
 *   - Les handlers répondent 200 par défaut
 *   - getRecordedCalls() capture les bodies par kind
 *   - failNextCallFor(kind) provoque une erreur la prochaine fois
 *   - reset nettoie l'état entre suites
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import {
  trackingProvidersHandlers,
  resetTrackingProviderMocks,
  getRecordedCalls,
  failNextCallFor,
} from './tracking-providers-handlers';

const server = setupServer(...trackingProvidersHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
beforeEach(() => resetTrackingProviderMocks());
afterEach(() => server.resetHandlers());

describe('trackingProvidersHandlers', () => {
  it('Meta /events répond 200 + capture le body', async () => {
    const res = await fetch('https://graph.facebook.com/v22.0/123/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: [{ event_name: 'Purchase' }] }),
    });
    expect(res.status).toBe(200);
    const calls = getRecordedCalls('meta');
    expect(calls).toHaveLength(1);
    const body = calls[0]!.body as { data: Array<{ event_name: string }> };
    expect(body.data[0]!.event_name).toBe('Purchase');
  });

  it('GA4 mp/collect répond 204', async () => {
    const res = await fetch('https://www.google-analytics.com/mp/collect', {
      method: 'POST',
      body: JSON.stringify({ client_id: 'x', events: [] }),
    });
    expect(res.status).toBe(204);
    expect(getRecordedCalls('google_ga4')).toHaveLength(1);
  });

  it('failNextCallFor(meta) provoque 401 la prochaine fois puis 200', async () => {
    failNextCallFor('meta');
    const r1 = await fetch('https://graph.facebook.com/v22.0/1/events', {
      method: 'POST',
      body: '{}',
    });
    expect(r1.status).toBe(401);
    const r2 = await fetch('https://graph.facebook.com/v22.0/1/events', {
      method: 'POST',
      body: '{}',
    });
    expect(r2.status).toBe(200);
  });

  it('TikTok / Snap / Pinterest répondent 200 par défaut', async () => {
    await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      body: '{}',
    });
    await fetch('https://tr.snapchat.com/v2/conversion', { method: 'POST', body: '{}' });
    await fetch('https://api.pinterest.com/v5/ad_accounts/123/events', {
      method: 'POST',
      body: '{}',
    });
    expect(getRecordedCalls('tiktok')).toHaveLength(1);
    expect(getRecordedCalls('snap')).toHaveLength(1);
    expect(getRecordedCalls('pinterest')).toHaveLength(1);
  });

  it('resetTrackingProviderMocks vide les calls', async () => {
    await fetch('https://graph.facebook.com/v22.0/1/events', { method: 'POST', body: '{}' });
    expect(getRecordedCalls()).toHaveLength(1);
    resetTrackingProviderMocks();
    expect(getRecordedCalls()).toHaveLength(0);
  });
});
