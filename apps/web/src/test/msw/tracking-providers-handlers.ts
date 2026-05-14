/**
 * MSW handlers pour les Providers tracking externes.
 *
 * Mocke les endpoints CAPI / Measurement Protocol pour les tests
 * intégration et e2e qui veulent valider le dispatcher serveur sans
 * polluer les comptes prod Meta/Google/TikTok/Snap/Pinterest.
 *
 * Chaque handler :
 *   - Accepte une URL pattern + capture le body en mémoire (`recordedCalls`)
 *   - Retourne 200 par défaut (ok)
 *   - Peut être paramétré via `failNextCallFor(kind)` pour simuler erreur transient
 *
 * Cf. docs/tracking-improvement/70-tests/ + dev-plan.csv T41.
 */

import { http, HttpResponse } from 'msw';

export interface RecordedCall {
  kind: 'meta' | 'google_ga4' | 'google_ads' | 'tiktok' | 'snap' | 'pinterest';
  url: string;
  body: unknown;
  receivedAt: number;
}

let recordedCalls: RecordedCall[] = [];
let failQueue: Partial<Record<RecordedCall['kind'], number>> = {};

export function resetTrackingProviderMocks(): void {
  recordedCalls = [];
  failQueue = {};
}

export function getRecordedCalls(kind?: RecordedCall['kind']): RecordedCall[] {
  return kind ? recordedCalls.filter((c) => c.kind === kind) : recordedCalls.slice();
}

export function failNextCallFor(kind: RecordedCall['kind'], times = 1): void {
  failQueue[kind] = (failQueue[kind] ?? 0) + times;
}

function consumeFail(kind: RecordedCall['kind']): boolean {
  const left = failQueue[kind];
  if (!left) return false;
  failQueue[kind] = left - 1;
  return true;
}

async function record(kind: RecordedCall['kind'], request: Request): Promise<void> {
  let body: unknown = null;
  try {
    body = await request.clone().json();
  } catch {
    try {
      body = await request.clone().text();
    } catch {
      body = null;
    }
  }
  recordedCalls.push({ kind, url: request.url, body, receivedAt: Date.now() });
}

export const trackingProvidersHandlers = [
  // Meta Graph API — pixelId/events. Path: graph.facebook.com/v{X}/{pixelId}/events
  http.post('https://graph.facebook.com/*/events', async ({ request }) => {
    await record('meta', request);
    if (consumeFail('meta')) {
      return HttpResponse.json(
        { error: { message: 'Token invalid (mocked)' } },
        { status: 401 },
      );
    }
    return HttpResponse.json({ events_received: 1, fbtrace_id: 'mock_trace' });
  }),

  // GA4 Measurement Protocol — googleappmeasurement / google-analytics
  http.post('https://www.google-analytics.com/mp/collect', async ({ request }) => {
    await record('google_ga4', request);
    if (consumeFail('google_ga4')) {
      return HttpResponse.text('Mocked GA4 error', { status: 500 });
    }
    return HttpResponse.text('', { status: 204 });
  }),

  // Google Ads conversion upload (skipped in scope mais mock prêt pour V2)
  http.post('https://googleads.googleapis.com/*', async ({ request }) => {
    await record('google_ads', request);
    if (consumeFail('google_ads')) {
      return HttpResponse.json({ error: { code: 401, message: 'Auth failed' } }, { status: 401 });
    }
    return HttpResponse.json({ results: [{ gclidDateTimePair: {} }] });
  }),

  // TikTok Events API
  http.post('https://business-api.tiktok.com/open_api/*/event/track/', async ({ request }) => {
    await record('tiktok', request);
    if (consumeFail('tiktok')) {
      return HttpResponse.json({ code: 40001, message: 'Mocked TikTok error' }, { status: 400 });
    }
    return HttpResponse.json({ code: 0, message: 'OK', request_id: 'mock_tt' });
  }),

  // Snap Pixel CAPI
  http.post('https://tr.snapchat.com/v2/conversion', async ({ request }) => {
    await record('snap', request);
    if (consumeFail('snap')) {
      return HttpResponse.json({ error: 'Mocked Snap error' }, { status: 500 });
    }
    return HttpResponse.json({ ok: true });
  }),

  // Pinterest Conversions API
  http.post('https://api.pinterest.com/v5/ad_accounts/*/events', async ({ request }) => {
    await record('pinterest', request);
    if (consumeFail('pinterest')) {
      return HttpResponse.json({ code: 1, message: 'Mocked Pinterest error' }, { status: 400 });
    }
    return HttpResponse.json({ num_events_received: 1, num_events_processed: 1 });
  }),
];
