import { NextResponse } from 'next/server';
import { logger } from '@/lib/logging/logger';
import { getClientIp, hashIp } from '@/lib/http/client-ip';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { SentinelPingInputSchema } from '@/lib/tracking/gtm/sentinel-schemas';
import { ingestPing } from '@/lib/tracking/gtm/drift-service';

/**
 * Couche B — Endpoint sentinel public.
 * Reçoit les pings du tag GTM à chaque première-pageview de session.
 *
 * cf. docs/gtm-poka-yoke/30-backend/01-api-spec.md
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_DEV_BASE_URL,
    'http://localhost:3000',
    'http://localhost:8011',
  ].filter(Boolean) as string[];
  return allowed.includes(origin);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const origin = request.headers.get('origin');
    if (!isAllowedOrigin(origin)) {
      return new Response(null, { status: 403 });
    }

    const ip = getClientIp(request);
    const rate = await checkRateLimit({
      key: `gtm-sentinel:${ip}`,
      limit: RATE_LIMIT,
      windowMs: RATE_WINDOW_MS,
    });
    if (!rate.ok) {
      logger.info?.('gtm.sentinel.rate_limited', { ip_hash: hashIp(ip) });
      return new Response(null, { status: 429 });
    }

    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = SentinelPingInputSchema.safeParse(json);
    if (!parsed.success) {
      logger.warn?.('gtm.sentinel.invalid_payload', { issues: parsed.error.issues });
      return NextResponse.json({ error: 'invalid_input', details: parsed.error.issues }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') ?? '';
    await ingestPing({
      ...parsed.data,
      uaHash: hashIp(userAgent),
      ipHash: hashIp(ip),
      rawPayload: { origin },
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    logger.error?.('gtm.sentinel.error', { err: String(err) });
    return new Response(null, { status: 500 });
  }
}
