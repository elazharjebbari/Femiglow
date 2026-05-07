import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getClientIp, hashIp } from '@/lib/http/client-ip';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { upsertConsentSnapshot } from '@/lib/db/queries/tracking/consent-snapshots';
import { enrichRequest } from '@/lib/tracking/server/enricher';
import type { TrackingConsentState } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

const consentStateSchema = z
  .object({
    ad_storage: z.enum(['granted', 'denied']),
    analytics_storage: z.enum(['granted', 'denied']),
    ad_user_data: z.enum(['granted', 'denied']),
    ad_personalization: z.enum(['granted', 'denied']),
    functional_storage: z.enum(['granted', 'denied']),
  })
  .strict();

const consentInputSchema = z
  .object({
    anonymous_id: z.string().min(4).max(64),
    state: consentStateSchema,
    source: z.enum(['banner', 'preferences', 'api', 'auto']).default('banner'),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const ipDigest = hashIp(ip);
  try {
    const rate = await checkRateLimit({
      key: `track-consent:${ip}`,
      limit: RATE_LIMIT,
      windowMs: RATE_WINDOW_MS,
    });
    if (!rate.ok) {
      throw new HttpError('rate_limited', 'Trop de requêtes');
    }

    const raw = (await request.json().catch(() => null)) as unknown;
    const parsed = consentInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }

    const enrichment = enrichRequest(request, ip);
    const snapshot = await upsertConsentSnapshot({
      anonymousId: parsed.data.anonymous_id,
      state: parsed.data.state as TrackingConsentState,
      source: parsed.data.source,
      ipAnonymized: enrichment.ipAnonymized,
      uaHash: enrichment.uaHash,
    });

    logger.info('tracking.consent.snapshot', {
      ip_hash: ipDigest,
      snapshot_id: snapshot.id,
      source: parsed.data.source,
    });

    return NextResponse.json({ ok: true, id: snapshot.id }, { status: 202 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
