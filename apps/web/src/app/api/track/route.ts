import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getClientIp, hashIp } from '@/lib/http/client-ip';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { logEvent } from '@/lib/db/queries/tracking/events-log';
import { bridgeWebTrackingToUserEvent } from '@/lib/user-events/bridges/web-tracking';
import { findTrackingPageByRoute } from '@/lib/db/queries/tracking/pages';
import { getValidator } from '@/lib/tracking/server/validator';
import { enrichRequest } from '@/lib/tracking/server/enricher';
import { isDuplicateEventId } from '@/lib/tracking/server/dedup';
import { dispatchToProviders } from '@/lib/tracking/server/dispatcher';
import { getEventCategory } from '@/lib/tracking/schemas';
import type { TrackingConsentState } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const CONVERSION_EVENTS = new Set([
  'purchase',
  'generate_lead',
  'sign_up',
  'begin_checkout',
  'lead_capture',
]);

const consentStateSchema = z
  .object({
    ad_storage: z.enum(['granted', 'denied']),
    analytics_storage: z.enum(['granted', 'denied']),
    ad_user_data: z.enum(['granted', 'denied']),
    ad_personalization: z.enum(['granted', 'denied']),
    functional_storage: z.enum(['granted', 'denied']),
  })
  .strict();

const incomingEventSchema = z
  .object({
    event: z.string().min(1).max(80),
    event_id: z.string().min(8).max(64),
    timestamp: z.string().datetime().optional(),
    schema_version: z.number().int().positive().optional(),
    consent: consentStateSchema,
    page: z
      .object({
        url: z.string().max(2000),
        path: z.string().max(2000),
        title: z.string().max(300).optional().default(''),
        referrer: z.string().max(2000).optional().default(''),
        locale: z.string().max(20).optional().default('fr-MA'),
      })
      .strict(),
    user: z
      .object({
        anonymous_id: z.string().min(4).max(64),
        session_id: z.string().min(4).max(64),
        user_id: z.string().max(64).optional(),
      })
      .strict(),
    source: z
      .object({
        component_id: z.string().max(64).optional(),
        component_name: z.string().max(120).optional(),
        page_id: z.string().max(64).optional(),
      })
      .partial()
      .optional(),
    context: z.record(z.unknown()).optional(),
    params: z.record(z.unknown()).optional(),
  })
  .strict();

const batchSchema = z
  .object({
    events: z.array(incomingEventSchema).min(1).max(50),
  })
  .strict();

interface IngestResult {
  accepted: number;
  rejected: number;
  duplicates: number;
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const ipDigest = hashIp(ip);
  try {
    const rate = await checkRateLimit({
      key: `track:${ip}`,
      limit: RATE_LIMIT,
      windowMs: RATE_WINDOW_MS,
    });
    if (!rate.ok) {
      logger.warn('tracking.ingest.rate_limited', { ip_hash: ipDigest });
      throw new HttpError('rate_limited', 'Trop de requêtes');
    }

    const raw = (await request.json().catch(() => null)) as unknown;
    if (raw === null) {
      throw new HttpError('invalid_input', 'Corps JSON invalide');
    }
    const parsed = batchSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn('tracking.ingest.invalid_batch', {
        ip_hash: ipDigest,
        issues: parsed.error.flatten(),
      });
      throw new HttpError('invalid_input', 'Batch invalide', parsed.error.flatten());
    }

    const enrichment = enrichRequest(request, ip);
    const result: IngestResult = { accepted: 0, rejected: 0, duplicates: 0 };

    for (const event of parsed.data.events) {
      const validator = getValidator(event.event);
      if (!validator) {
        result.rejected += 1;
        logger.warn('tracking.ingest.unknown_event', { event_name: event.event });
        continue;
      }
      const paramsParsed = validator.safeParse(event.params ?? {});
      if (!paramsParsed.success) {
        result.rejected += 1;
        logger.warn('tracking.ingest.invalid_params', {
          event_name: event.event,
          issues: paramsParsed.error.flatten(),
        });
        continue;
      }

      if (isDuplicateEventId(event.event_id)) {
        result.duplicates += 1;
        continue;
      }

      const consentDenied =
        event.consent.analytics_storage === 'denied' &&
        event.consent.ad_storage === 'denied';
      if (consentDenied && event.event !== 'fg_consent_change') {
        result.rejected += 1;
        continue;
      }

      const page = event.source?.page_id
        ? null
        : await findTrackingPageByRoute(event.page.path).catch(() => null);

      const dispatch = await dispatchToProviders({
        eventName: event.event,
        eventId: event.event_id,
        receivedAt: event.timestamp ? new Date(event.timestamp) : new Date(),
        pageRoute: event.page.path,
        pageUrl: event.page.url,
        pageTitle: event.page.title,
        referrer: event.page.referrer,
        anonymousId: event.user.anonymous_id,
        sessionId: event.user.session_id,
        userId: event.user.user_id ?? null,
        consent: event.consent as TrackingConsentState,
        uaHash: enrichment.uaHash,
        ipAnonymized: enrichment.ipAnonymized,
        device: enrichment.device,
        locale: event.page.locale || enrichment.locale,
        params: paramsParsed.data as Record<string, unknown>,
      }).catch((err) => {
        logger.error('tracking.dispatch.failed', {
          event_name: event.event,
          error: err instanceof Error ? err.message : String(err),
        });
        return { dispatched: [], results: {} };
      });

      try {
        await logEvent({
          id: createId('tev'),
          eventId: event.event_id,
          eventName: event.event,
          eventCategory: getEventCategory(event.event),
          pageId: event.source?.page_id ?? page?.id ?? null,
          componentId: event.source?.component_id ?? null,
          pageRoute: event.page.path,
          anonymousId: event.user.anonymous_id,
          sessionId: event.user.session_id,
          userId: event.user.user_id ?? null,
          consentSnapshot: event.consent as TrackingConsentState,
          payload: paramsParsed.data as Record<string, unknown>,
          uaHash: enrichment.uaHash,
          ipAnonymized: enrichment.ipAnonymized,
          device: enrichment.device,
          locale: event.page.locale || enrichment.locale,
          isConversion: CONVERSION_EVENTS.has(event.event),
          providersDispatched: dispatch.dispatched,
          providersResults: dispatch.results,
          receivedAt: event.timestamp ? new Date(event.timestamp) : new Date(),
          schemaVersion: event.schema_version ?? 1,
        });
        result.accepted += 1;

        // M5.2 — bridge vers user_event (unified). Fire-and-forget : ne
        // doit jamais bloquer ni faire échouer le flow tracking principal.
        void bridgeWebTrackingToUserEvent({
          eventName: event.event,
          email: null, // sera extrait du payload par le bridge
          sessionId: event.user.session_id,
          properties: paramsParsed.data as Record<string, unknown>,
          ts: event.timestamp ? new Date(event.timestamp) : undefined,
        });
      } catch (err) {
        result.rejected += 1;
        logger.error('tracking.ingest.persist_failed', {
          event_name: event.event,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('tracking.ingest.completed', {
      ip_hash: ipDigest,
      accepted: result.accepted,
      rejected: result.rejected,
      duplicates: result.duplicates,
    });

    return NextResponse.json(
      { ok: true, ...result },
      { status: 202, headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
