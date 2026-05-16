import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { updateDeliveryCityPositions } from '@/lib/db/queries/delivery-cities';
import { deliveryCityPositionsSchema } from '@/lib/checkout/delivery/schemas';
import { logAuditEvent } from '@/lib/audit/log-event';

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.redirect('/admin/login');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_input', message: 'JSON invalide.' } },
      { status: 400 },
    );
  }

  const parsed = deliveryCityPositionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'validation_failed',
          message: parsed.error.issues[0]?.message ?? 'Validation en échec.',
          details: parsed.error.issues,
        },
      },
      { status: 400 },
    );
  }

  const { positions } = parsed.data;
  const actorId = session.adminId ?? null;

  const result = await updateDeliveryCityPositions(positions, { actorId });

  await logAuditEvent({
    action: 'delivery_cities.update_positions',
    actorId,
    resourceType: 'delivery_cities',
    meta: { updated: result.updated, notFound: result.notFound },
  });

  return NextResponse.json(result);
}