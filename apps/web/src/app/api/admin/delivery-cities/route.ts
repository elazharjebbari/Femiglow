/**
 * GET  /api/admin/delivery-cities → liste paginée (admin)
 * POST /api/admin/delivery-cities → création manuelle (source='manual' par défaut)
 */
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  createDeliveryCity,
  findDeliveryCityBySlug,
  listDeliveryCities,
} from '@/lib/db/queries/delivery-cities';
import {
  deliveryCityCreateSchema,
  deliveryCityListQuerySchema,
} from '@/lib/checkout/delivery/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const raw = {
      q: url.searchParams.get('q') ?? undefined,
      active: url.searchParams.get('active') ?? undefined,
      source: url.searchParams.get('source') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      sort: url.searchParams.get('sort') ?? undefined,
    };
    const parsed = deliveryCityListQuerySchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Paramètres invalides', parsed.error.issues);
    }
    const { q, active, source, page, pageSize, sort } = parsed.data;

    const result = await listDeliveryCities({
      q,
      active: active === 'all' ? 'all' : active === 'true',
      source,
      page,
      pageSize,
      sort,
    });
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = deliveryCityCreateSchema.safeParse(raw);
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

    const existing = await findDeliveryCityBySlug(parsed.data.slug);
    if (existing) {
      throw new HttpError(
        'conflict',
        `Une ville avec le slug "${parsed.data.slug}" existe déjà.`,
      );
    }

    const created = await createDeliveryCity(parsed.data, { actorId: session.adminId });
    if (!created) throw new HttpError('internal_error', 'Création échouée.');

    revalidatePath('/admin/settings/delivery-cities');
    await logAuditEvent({
      action: 'delivery_cities.create',
      actorId: session.adminId,
      resourceType: 'delivery_city',
      resourceId: created.id,
      meta: {
        slug: created.slug,
        nameFr: created.nameFr,
        priceMad: created.deliveryPriceMad,
        source: created.source,
      },
    });

    return NextResponse.json({ city: created }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
