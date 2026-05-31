/**
 * GET    /api/admin/delivery-cities/[slug] → détail admin
 * PATCH  /api/admin/delivery-cities/[slug] → édition (prix, ETA, alias, …)
 *
 *   Note métier : éditer une ville d'origine `sendit` la fait passer en
 *   `source='manual'` automatiquement — c'est cette transition qui protège
 *   les éditions admin contre les bulk-upsert ultérieurs du seeder
 *   (cf. `bulkUpsertDeliveryCities` règle "préserve éditions admin").
 *
 * DELETE /api/admin/delivery-cities/[slug] → suppression (rare ; préférer
 *   `isActive=false` pour conserver l'historique)
 */
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  deleteDeliveryCity,
  findDeliveryCityBySlug,
  updateDeliveryCity,
} from '@/lib/db/queries/delivery-cities';
import { deliveryCityPatchSchema } from '@/lib/checkout/delivery/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const slug = (params.slug ?? '').trim().toLowerCase();
    const city = await findDeliveryCityBySlug(slug);
    if (!city) throw new HttpError('not_found', 'Ville introuvable.');
    return NextResponse.json({ city });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const slug = (params.slug ?? '').trim().toLowerCase();
    const existing = await findDeliveryCityBySlug(slug);
    if (!existing) throw new HttpError('not_found', 'Ville introuvable.');

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = deliveryCityPatchSchema.safeParse(raw);
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
    // Au moins un champ doit être présent.
    const patch = parsed.data;
    const fieldKeys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
    if (fieldKeys.length === 0) {
      throw new HttpError('invalid_input', 'Aucun champ à mettre à jour.');
    }

    // Promotion automatique vers `manual` si l'admin édite une ville sendit
    // (sauf si l'admin explicite une source différente). Cette transition
    // est le garde-fou des éditions vis-à-vis du seeder.
    const finalPatch =
      patch.source === undefined && existing.source === 'sendit'
        ? { ...patch, source: 'manual' as const }
        : patch;

    const updated = await updateDeliveryCity(slug, finalPatch, { actorId: session.adminId });
    if (!updated) throw new HttpError('not_found', 'Ville introuvable.');

    revalidatePath('/admin/settings/delivery-cities');
    await logAuditEvent({
      action: 'delivery_cities.update',
      actorId: session.adminId,
      resourceType: 'delivery_city',
      resourceId: updated.id,
      meta: {
        slug,
        fields: fieldKeys,
        promotedToManual: finalPatch.source === 'manual' && existing.source === 'sendit',
      },
    });
    return NextResponse.json({ city: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const slug = (params.slug ?? '').trim().toLowerCase();
    const existing = await findDeliveryCityBySlug(slug);
    if (!existing) throw new HttpError('not_found', 'Ville introuvable.');

    const ok = await deleteDeliveryCity(slug);
    if (!ok) throw new HttpError('internal_error', 'Suppression échouée.');

    revalidatePath('/admin/settings/delivery-cities');
    await logAuditEvent({
      action: 'delivery_cities.delete',
      actorId: session.adminId,
      resourceType: 'delivery_city',
      resourceId: existing.id,
      meta: { slug, source: existing.source },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
