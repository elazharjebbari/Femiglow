/**
 * MSW handlers pour le pipeline attribution end-to-end.
 *
 * Mocke :
 *  - `POST /api/track` : ingest événements (validation + persistence simulée)
 *  - `POST /api/track/attribution` : upsert visitor_attribution simulé
 *  - `GET /api/admin/debug/last-events` : retourne les events enregistrés
 *
 * Permet de tester le pipeline complet client → serveur → reporting sans
 * vraie DB ni vraies routes Next.js, dans des tests vitest.
 *
 * Référence : `docs/attribution-fix-2026-05/04-tests-strategy.md` § MSW.
 */
import { http, HttpResponse } from 'msw';

import type { TrafficBucket } from '@/lib/tracking/taxonomy';

// ─────────────────────────────────────────────────────────────────────────────
// Store en mémoire pour simuler la DB côté tests
// ─────────────────────────────────────────────────────────────────────────────

export interface RecordedTrackEvent {
  eventId: string;
  eventName: string;
  pageRoute: string;
  anonymousId: string;
  sessionId: string;
  trafficSource: TrafficBucket | null;
  trafficMedium: string | null;
  payload: Record<string, unknown>;
  attribution?: {
    channel?: string;
    is_paid?: boolean;
    utm?: { source?: string; medium?: string; campaign?: string };
  };
  receivedAt: number;
}

export interface RecordedAttributionUpsert {
  anonymousId: string;
  channel: string;
  isPaid: boolean;
  utm?: { source?: string; medium?: string; campaign?: string };
  receivedAt: number;
}

let trackEvents: RecordedTrackEvent[] = [];
let attributionUpserts: RecordedAttributionUpsert[] = [];
let shouldRejectNext = false;
let nextRejectStatus = 500;

export function resetAttributionMocks(): void {
  trackEvents = [];
  attributionUpserts = [];
  shouldRejectNext = false;
  nextRejectStatus = 500;
}

export function getTrackEvents(): RecordedTrackEvent[] {
  return trackEvents.slice();
}

export function getLastTrackEvent(): RecordedTrackEvent | null {
  return trackEvents.length > 0 ? trackEvents[trackEvents.length - 1]! : null;
}

export function getAttributionUpserts(): RecordedAttributionUpsert[] {
  return attributionUpserts.slice();
}

/**
 * Configure le prochain POST /api/track pour échouer (test failure path).
 */
export function rejectNextTrackCall(status = 500): void {
  shouldRejectNext = true;
  nextRejectStatus = status;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mock léger de la classification — utilisé uniquement pour simuler la
 * persistance enrichie dans les tests MSW. Match la logique réelle de
 * `classifyTraffic` sans la dépendance circulaire.
 */
function mockClassify(event: Record<string, unknown>): {
  trafficSource: TrafficBucket;
  trafficMedium: string;
} {
  const params = (event.params ?? {}) as Record<string, unknown>;
  const attribution = (event.attribution ?? {}) as {
    channel?: string;
    is_paid?: boolean;
    utm?: { source?: string; medium?: string };
  };

  // Priorité : attribution explicite (clientHint) > UTM params > direct
  if (attribution.is_paid && attribution.channel) {
    if (attribution.channel === 'meta' || attribution.channel === 'tiktok')
      return { trafficSource: 'paid_social', trafficMedium: 'cpc' };
    if (attribution.channel === 'google_ads')
      return { trafficSource: 'paid_search', trafficMedium: 'cpc' };
  }
  if (typeof params.gclid === 'string')
    return { trafficSource: 'paid_search', trafficMedium: 'cpc' };
  if (typeof params.fbclid === 'string')
    return { trafficSource: 'paid_social', trafficMedium: 'cpc' };

  return { trafficSource: 'direct', trafficMedium: 'none' };
}

export const attributionHandlers = [
  // POST /api/track — ingest events
  http.post(/\/api\/track$/, async ({ request }) => {
    if (shouldRejectNext) {
      shouldRejectNext = false;
      return HttpResponse.json(
        { error: 'simulated', message: 'Test simulated failure' },
        { status: nextRejectStatus },
      );
    }

    const body = (await request.json()) as { events?: Array<Record<string, unknown>> };
    const events = body.events ?? [];

    for (const event of events) {
      const user = (event.user as Record<string, string>) ?? {};
      const page = (event.page as Record<string, string>) ?? {};
      const classification = mockClassify(event);

      trackEvents.push({
        eventId: (event.event_id as string) ?? 'evt_' + trackEvents.length,
        eventName: (event.event as string) ?? 'unknown',
        pageRoute: page.path ?? '/',
        anonymousId: user.anonymous_id ?? 'anon-unknown',
        sessionId: user.session_id ?? 'sess-unknown',
        trafficSource: classification.trafficSource,
        trafficMedium: classification.trafficMedium,
        payload: (event.params as Record<string, unknown>) ?? {},
        attribution: event.attribution as RecordedTrackEvent['attribution'],
        receivedAt: Date.now(),
      });
    }

    return HttpResponse.json({
      accepted: events.length,
      rejected: 0,
      duplicates: 0,
    });
  }),

  // POST /api/track/attribution — upsert visitor_attribution
  http.post(/\/api\/track\/attribution$/, async ({ request }) => {
    const body = (await request.json()) as {
      anonymous_id?: string;
      touch?: {
        channel?: string;
        is_paid?: boolean;
        utm?: { source?: string; medium?: string; campaign?: string };
      };
    };

    if (body.anonymous_id && body.touch?.channel) {
      attributionUpserts.push({
        anonymousId: body.anonymous_id,
        channel: body.touch.channel,
        isPaid: body.touch.is_paid ?? false,
        utm: body.touch.utm,
        receivedAt: Date.now(),
      });
    }

    return HttpResponse.json({ ok: true });
  }),

  // GET /api/admin/debug/last-events — retourne le store mocké
  http.get(/\/api\/admin\/debug\/last-events/, ({ request }) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    const limit = Math.min(50, parseInt(url.searchParams.get('limit') ?? '10', 10));

    let events = trackEvents.slice();
    if (sessionId) {
      events = events.filter((e) => e.sessionId === sessionId);
    }
    events = events.sort((a, b) => b.receivedAt - a.receivedAt).slice(0, limit);
    return HttpResponse.json(events);
  }),
];
