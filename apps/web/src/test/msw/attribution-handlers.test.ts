/**
 * Tests intégration MSW — pipeline attribution end-to-end.
 *
 * Couvre le flow complet : client POST /api/track → mock serveur enrichit
 * et persiste → GET /api/admin/debug/last-events retourne avec
 * trafficSource peuplé.
 *
 * Si ces tests passent, on a la preuve que les surfaces externes
 * (client → API → reporting) communiquent correctement.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { setupServer } from 'msw/node';

import {
  attributionHandlers,
  getLastTrackEvent,
  getTrackEvents,
  getAttributionUpserts,
  rejectNextTrackCall,
  resetAttributionMocks,
} from './attribution-handlers';

const server = setupServer(...attributionHandlers);

const BASE_URL = 'http://localhost';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterAll(() => server.close());

beforeEach(() => {
  resetAttributionMocks();
  server.resetHandlers(...attributionHandlers);
});

afterEach(() => {
  resetAttributionMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — simulent un client qui appelle /api/track
// ─────────────────────────────────────────────────────────────────────────────

interface TrackPayload {
  events: Array<{
    event_id: string;
    event: string;
    timestamp?: string;
    page: { url: string; path: string; referrer?: string; locale?: string };
    user: { anonymous_id: string; session_id: string; user_id?: string | null };
    consent: Record<string, 'granted' | 'denied'>;
    schema_version: number;
    params?: Record<string, unknown>;
    attribution?: {
      channel?: string;
      is_paid?: boolean;
      utm?: { source?: string; medium?: string; campaign?: string };
    };
  }>;
}

async function postTrack(payload: TrackPayload): Promise<Response> {
  return fetch(`${BASE_URL}/api/track`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function postAttribution(body: {
  anonymous_id: string;
  touch: {
    channel: string;
    is_paid: boolean;
    utm?: { source?: string; medium?: string };
  };
}): Promise<Response> {
  return fetch(`${BASE_URL}/api/track/attribution`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function getDebugEvents(sessionId?: string): Promise<unknown[]> {
  const url = new URL(`${BASE_URL}/api/admin/debug/last-events`);
  if (sessionId) url.searchParams.set('sessionId', sessionId);
  const res = await fetch(url);
  return res.json();
}

function makeEvent(overrides: Partial<TrackPayload['events'][0]> = {}): TrackPayload['events'][0] {
  return {
    event_id: 'evt_' + Math.random().toString(36).slice(2),
    event: 'page_view',
    timestamp: new Date().toISOString(),
    page: { url: 'https://femiglow.com/kit', path: '/kit', locale: 'fr-MA' },
    user: { anonymous_id: 'anon-test', session_id: 'sess-test' },
    consent: {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functional_storage: 'granted',
    },
    schema_version: 1,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('MSW pipeline — /api/track ingest', () => {
  it('event avec attribution Meta paid → trafficSource=paid_social persisté', async () => {
    const res = await postTrack({
      events: [
        makeEvent({
          attribution: {
            channel: 'meta',
            is_paid: true,
            utm: { source: 'meta', medium: 'cpc' },
          },
        }),
      ],
    });
    expect(res.status).toBe(200);

    const last = getLastTrackEvent();
    expect(last?.trafficSource).toBe('paid_social');
    expect(last?.trafficMedium).toBe('cpc');
  });

  it('event avec gclid dans params → paid_search', async () => {
    await postTrack({
      events: [
        makeEvent({
          params: { gclid: 'GCLID-XYZ' },
        }),
      ],
    });

    const last = getLastTrackEvent();
    expect(last?.trafficSource).toBe('paid_search');
  });

  it('event sans signal → direct', async () => {
    await postTrack({ events: [makeEvent()] });

    const last = getLastTrackEvent();
    expect(last?.trafficSource).toBe('direct');
  });

  it('batch de 3 events → tous persistés', async () => {
    await postTrack({
      events: [
        makeEvent({ event_id: 'e1' }),
        makeEvent({ event_id: 'e2', params: { gclid: 'G' } }),
        makeEvent({
          event_id: 'e3',
          attribution: { channel: 'meta', is_paid: true },
        }),
      ],
    });

    const events = getTrackEvents();
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.trafficSource)).toEqual([
      'direct',
      'paid_search',
      'paid_social',
    ]);
  });

  it('serveur retourne accepted count correct', async () => {
    const res = await postTrack({
      events: [makeEvent(), makeEvent()],
    });
    const body = (await res.json()) as { accepted: number };
    expect(body.accepted).toBe(2);
  });
});

describe('MSW pipeline — /api/track/attribution upsert', () => {
  it('upsert visitor_attribution → enregistré', async () => {
    await postAttribution({
      anonymous_id: 'visitor-1',
      touch: {
        channel: 'meta',
        is_paid: true,
        utm: { source: 'meta', medium: 'cpc' },
      },
    });

    const upserts = getAttributionUpserts();
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.channel).toBe('meta');
    expect(upserts[0]?.isPaid).toBe(true);
  });

  it('multiple upserts même visitor → tous enregistrés (multi-touch)', async () => {
    await postAttribution({
      anonymous_id: 'v1',
      touch: { channel: 'meta', is_paid: true },
    });
    await postAttribution({
      anonymous_id: 'v1',
      touch: { channel: 'google_ads', is_paid: true },
    });

    expect(getAttributionUpserts()).toHaveLength(2);
  });
});

describe('MSW pipeline — /api/admin/debug/last-events', () => {
  it('retourne les events persistés', async () => {
    await postTrack({
      events: [
        makeEvent({
          event_id: 'e1',
          attribution: { channel: 'meta', is_paid: true },
        }),
      ],
    });

    const events = (await getDebugEvents()) as Array<{ trafficSource: string }>;
    expect(events).toHaveLength(1);
    expect(events[0].trafficSource).toBe('paid_social');
  });

  it('filtre par sessionId', async () => {
    await postTrack({
      events: [
        makeEvent({
          event_id: 'e1',
          user: { anonymous_id: 'a1', session_id: 'sess-A' },
        }),
        makeEvent({
          event_id: 'e2',
          user: { anonymous_id: 'a2', session_id: 'sess-B' },
        }),
      ],
    });

    const sessA = (await getDebugEvents('sess-A')) as Array<{ eventId: string }>;
    expect(sessA).toHaveLength(1);
    expect(sessA[0].eventId).toBe('e1');
  });

  it('événements triés du plus récent au plus ancien', async () => {
    await postTrack({ events: [makeEvent({ event_id: 'old' })] });
    await new Promise((r) => setTimeout(r, 5));
    await postTrack({ events: [makeEvent({ event_id: 'mid' })] });
    await new Promise((r) => setTimeout(r, 5));
    await postTrack({ events: [makeEvent({ event_id: 'new' })] });

    const events = (await getDebugEvents()) as Array<{ eventId: string }>;
    expect(events.map((e) => e.eventId)).toEqual(['new', 'mid', 'old']);
  });
});

describe('MSW pipeline — failure paths', () => {
  it('rejectNextTrackCall → 500 puis retour à 200', async () => {
    rejectNextTrackCall(500);
    const res1 = await postTrack({ events: [makeEvent()] });
    expect(res1.status).toBe(500);
    expect(getTrackEvents()).toHaveLength(0);

    // Le suivant passe
    const res2 = await postTrack({ events: [makeEvent()] });
    expect(res2.status).toBe(200);
    expect(getTrackEvents()).toHaveLength(1);
  });
});

describe('MSW pipeline — multi-step user journey', () => {
  it('scénario complet : Meta paid landing → page_view enrichi → lead_capture conversion', async () => {
    // Étape 1 : visiteur landing Meta paid → /api/track/attribution
    await postAttribution({
      anonymous_id: 'jane-doe-123',
      touch: {
        channel: 'meta',
        is_paid: true,
        utm: { source: 'meta', medium: 'cpc' },
      },
    });

    // Étape 2 : page_view avec hint attribution depuis le client
    await postTrack({
      events: [
        makeEvent({
          event_id: 'pv-1',
          event: 'page_view',
          user: { anonymous_id: 'jane-doe-123', session_id: 'sess-jane' },
          attribution: {
            channel: 'meta',
            is_paid: true,
            utm: { source: 'meta', medium: 'cpc' },
          },
        }),
      ],
    });

    // Étape 3 : lead_capture (conversion)
    await postTrack({
      events: [
        makeEvent({
          event_id: 'lc-1',
          event: 'lead_capture',
          user: { anonymous_id: 'jane-doe-123', session_id: 'sess-jane' },
          attribution: {
            channel: 'meta',
            is_paid: true,
            utm: { source: 'meta', medium: 'cpc' },
          },
        }),
      ],
    });

    // Vérif : les 2 events sont taggés paid_social
    const events = (await getDebugEvents('sess-jane')) as Array<{
      eventId: string;
      eventName: string;
      trafficSource: string;
    }>;
    expect(events).toHaveLength(2);
    for (const e of events) {
      expect(e.trafficSource).toBe('paid_social');
    }
    // L'attribution upsert a bien été appelée 1 fois
    expect(getAttributionUpserts()).toHaveLength(1);
  });
});
