/**
 * POST /api/admin/delivery-cities/seed
 *
 * Déclenche un re-seed manuel du catalogue villes à partir du fixture
 * sendit. Idempotent par défaut — préserve les éditions admin via le
 * filtre `source !== 'sendit'` côté `bulkUpsertDeliveryCities`.
 *
 * Body JSON :
 *   { force?: boolean, fixturePath?: string }
 *
 * `force=true` écrase aussi les villes éditées manuellement — usage rare,
 * normalement réservé à une opération de reset.
 *
 * Réponse 200 :
 *   {
 *     fixturePath: string,
 *     importer: { parsed, unique, dropped, droppedReasons },
 *     database: { inserted, updated, skipped, preservedSlugs },
 *   }
 */
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';
import { runDeliveryCitiesSeed } from '../../../../../../scripts/seed-delivery-cities';
import { deliveryCitySeedSchema } from '@/lib/checkout/delivery/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    // Body optionnel (peut être vide → `force=false`).
    let raw: unknown = {};
    try {
      const text = await request.text();
      if (text.trim()) raw = JSON.parse(text);
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = deliveryCitySeedSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Payload invalide',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const t0 = Date.now();
    const report = await runDeliveryCitiesSeed({
      force: parsed.data.force,
      fixturePath: parsed.data.fixturePath,
      actorId: session.adminId,
    });
    const elapsedMs = Date.now() - t0;

    revalidatePath('/admin/settings/delivery-cities');
    await logAuditEvent({
      action: 'delivery_cities.seed',
      actorId: session.adminId,
      resourceType: 'delivery_city',
      resourceId: null,
      meta: {
        force: parsed.data.force,
        elapsedMs,
        inserted: report.database.inserted,
        updated: report.database.updated,
        skipped: report.database.skipped,
        preservedCount: report.database.preservedSlugs.length,
        unique: report.importer.unique,
      },
    });

    logger.info('delivery-cities.seed.ok', {
      actor_id: session.adminId,
      force: parsed.data.force,
      ms: elapsedMs,
      inserted: report.database.inserted,
      updated: report.database.updated,
      skipped: report.database.skipped,
    });

    return NextResponse.json({
      ...report,
      elapsedMs,
    });
  } catch (err) {
    logger.error('delivery-cities.seed.failed', { error: String(err) });
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
