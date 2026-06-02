/**
 * OWBS — POST /api/checkout/lead/sync
 *
 * Endpoint **batch** idempotent : transport du flush live (keepalive) ET du
 * flush de dernier recours (`navigator.sendBeacon` au `pagehide`). Applique
 * chaque envelope en upsert/patch idempotent, tolère le désordre, et renvoie un
 * rapport par envelope. `sendBeacon` ne pose pas d'en-tête custom → la clé
 * d'idempotence est portée dans le corps (inerte ici : l'idempotence vient de
 * l'upsert-by-leadId).
 *
 * Inerte tant que le flag serveur est OFF (204).
 *
 * @see docs/checkout-leads-background-2026-06-01/00-conception/decisions/ADR-0005-beacon-flush.md
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { errorResponse } from '@/lib/checkout/api/response';
import { leadService, type BatchEnvelope } from '@/lib/checkout/services/lead-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ENVELOPES = 32;
const MAX_BYTES = 60_000;

const batchEnvelopeSchema = z.object({
  mutationId: z.string().min(1).max(64),
  leadId: z.string().regex(/^cl_[0-9a-z]{20,}$/),
  scope: z.enum(['lead_create', 'address_update', 'payment_select']),
  idempotencyKey: z.string().optional(),
  payload: z.unknown(),
});

const syncBatchSchema = z.object({
  schemaVersion: z.number().optional(),
  sentVia: z.enum(['beacon', 'keepalive', 'reload-recovery']).optional(),
  envelopes: z.array(batchEnvelopeSchema).min(1).max(MAX_ENVELOPES),
});

export async function POST(req: NextRequest): Promise<Response> {
  // Feature OFF → no-op silencieux (le beacon ne doit jamais échouer bruyamment).
  if (env.CHECKOUT_OPTIMISTIC_WIZARD_ENABLED !== 'true') {
    return new NextResponse(null, { status: 204 });
  }

  // sendBeacon envoie un Blob → on lit le texte (content-type non garanti).
  const raw = await req.text();
  if (raw.length > MAX_BYTES) {
    return NextResponse.json(
      { error: { code: 'payload_too_large', message: 'Batch trop volumineux.' } },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return errorResponse('invalid_json', 'JSON invalide.');
  }

  const parsed = syncBatchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('invalid_input', 'Batch invalide.', parsed.error.issues);
  }

  try {
    const envelopes: BatchEnvelope[] = parsed.data.envelopes.map((e) => ({
      mutationId: e.mutationId,
      leadId: e.leadId,
      scope: e.scope,
      payload: e.payload,
    }));
    const results = await leadService.applyBatch(envelopes);
    logger.info('owbs.sync.batch', {
      sentVia: parsed.data.sentVia ?? 'keepalive',
      count: results.length,
      applied: results.filter((r) => r.ok).length,
    });
    return NextResponse.json({ results });
  } catch (err) {
    logger.error('owbs.sync.failed', { error: String(err) });
    return errorResponse('internal_error', 'Erreur interne.');
  }
}
