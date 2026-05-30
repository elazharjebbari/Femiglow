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
import { isDuplicateEventId, isDuplicateEventIdAsync } from '@/lib/tracking/server/dedup';
import { dispatchToProviders } from '@/lib/tracking/server/dispatcher';
import { getEventCategory } from '@/lib/tracking/schemas';
import type { TrackingConsentState } from '@/lib/db/types';
// Attribution v2 — résolution server-side authoritative (cf. audit).
// Référence : `docs/attribution-fix-2026-05/02-vision-architecture.md`.
import { ATTRIBUTION_VERSION } from '@/lib/feature-flags/attribution';
import { extractRequestSignals } from '@/lib/tracking/server/request-signals';
import { enrichEvent, type EnrichedEvent } from '@/lib/tracking/server/enrich-event';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/**
 * `maxDuration` 10s pour l'ingest tracking — synchrone, doit rester
 * snappy. Si la latence /api/track P95 approche 10s, c'est qu'il faut
 * activer le batching CAPI (cf. Sprint 2 S2).
 *
 * Référence : docs/live-systems-fix-2026-05/03-plan-action-phases.md § QW3.
 */
export const maxDuration = 10;

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

const userDataSchema = z
  .object({
    sha256_email_address: z.string().min(32).max(128).optional(),
    sha256_phone_number: z.string().min(32).max(128).optional(),
    address: z
      .object({
        sha256_first_name: z.string().min(32).max(128).optional(),
        sha256_last_name: z.string().min(32).max(128).optional(),
        city: z.string().max(120).optional(),
        country: z.string().max(2).optional(),
      })
      .partial()
      .optional(),
  })
  .partial()
  .strict();

const attributionSchema = z
  .object({
    channel: z.string().max(40),
    is_paid: z.boolean(),
    strategy: z.string().max(40),
    reason: z.string().max(80),
    click_id: z.string().max(512).optional(),
    click_id_field: z.string().max(40).optional(),
    utm: z
      .object({
        source: z.string().max(120).optional(),
        medium: z.string().max(120).optional(),
        campaign: z.string().max(120).optional(),
        term: z.string().max(120).optional(),
        content: z.string().max(120).optional(),
      })
      .partial()
      .optional(),
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
    user_data: userDataSchema.optional(),
    attribution: attributionSchema.optional(),
  })
  .passthrough();

const batchSchema = z
  .object({
    events: z.array(incomingEventSchema).min(1).max(50),
  })
  .passthrough();

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

      // ⭐ S1 — Dedup robuste cross-lambda via Redis si v2.
      // Fallback gracieux vers Map locale (v1) sinon.
      // Référence : docs/live-systems-fix-2026-05/08-system-tracking.md
      if (await isDuplicateEventIdAsync(event.event_id)) {
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
        userAgent: request.headers.get('user-agent') ?? undefined,
        ipAnonymized: enrichment.ipAnonymized,
        device: enrichment.device,
        locale: event.page.locale || enrichment.locale,
        params: paramsParsed.data as Record<string, unknown>,
        userData: event.user_data,
        attribution: event.attribution,
      }).catch((err) => {
        logger.error('tracking.dispatch.failed', {
          event_name: event.event,
          error: err instanceof Error ? err.message : String(err),
        });
        return { dispatched: [], results: {} };
      });

      // ── Attribution v2 : résolution server-side authoritative ─────────
      // Le flag `ATTRIBUTION_V2` (default v1) garde la rétrocompat. Quand
      // ON, on enrichit l'event avec `trafficSource`/`trafficMedium` avant
      // l'INSERT. Quand OFF, comportement identique à avant (colonnes NULL).
      let enriched: EnrichedEvent | null = null;
      if (ATTRIBUTION_VERSION === 'v2') {
        try {
          const cookieReader = {
            get: (name: string) => {
              const cookieHeader = request.headers.get('cookie') ?? '';
              const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
              return match ? { value: decodeURIComponent(match[1]!) } : undefined;
            },
          };
          const signals = extractRequestSignals({
            cookies: cookieReader,
            referrer: event.page.referrer ?? request.headers.get('referer') ?? null,
          });
          enriched = await enrichEvent({
            anonymousId: event.user.anonymous_id,
            clientHint: event.attribution
              ? {
                  channel: event.attribution.channel,
                  isPaid: event.attribution.is_paid,
                  utm: event.attribution.utm,
                }
              : null,
            requestSignals: signals,
          });
        } catch (err) {
          // Ne JAMAIS faire échouer l'ingest pour un problème d'enrichissement.
          // On log + persiste sans attribution (équivalent v1).
          logger.warn('tracking.enrich.failed', {
            event_name: event.event,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

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
          // 🔥 Fix attribution audit cause #1 — colonnes désormais persistées.
          trafficSource: enriched?.trafficSource ?? null,
          trafficMedium: enriched?.trafficMedium ?? null,
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
