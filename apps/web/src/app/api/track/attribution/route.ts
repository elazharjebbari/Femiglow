/**
 * POST /api/track/attribution — upsert d'un touch d'attribution pour
 * un visiteur. Appelé par `AttributionCaptureBridge` au mount.
 *
 * Public (visitor-facing). Rate-limited par IP/visitor_id pour éviter
 * le flood. Pas de PII collectée (les click_ids sont anonymes).
 *
 * Body :
 *   {
 *     visitor_id: 'v_xxx',
 *     touch: ChannelTouch (cf. types.ts)
 *   }
 *
 * Réponse :
 *   200 { ok: true, snapshot: AttributionSnapshot }
 *   400 { ok: false, error: 'invalid_input' }
 *   429 { ok: false, error: 'rate_limited' }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logging/logger';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { upsertAttribution } from '@/lib/tracking/attribution/repository';
import { channelTouchSchema } from '@/lib/tracking/attribution/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  visitor_id: z.string().min(3).max(120),
  touch: channelTouchSchema,
});

export async function POST(req: Request): Promise<Response> {
  // Rate limit : 30 req/min/IP. Une visite = 1-2 calls max.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkRateLimit({
    key: `attr:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    // Conversion snake_case (API contract) → camelCase (repository).
    const snapshot = await upsertAttribution({
      visitorId: parsed.data.visitor_id,
      touch: parsed.data.touch,
    });
    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    logger.warn('attribution.upsert_failed', {
      visitor_id: parsed.data.visitor_id,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { ok: false, error: 'internal_error' },
      { status: 500 },
    );
  }
}
