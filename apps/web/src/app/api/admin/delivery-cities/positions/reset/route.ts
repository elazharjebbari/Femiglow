import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { updateDeliveryCityPositions } from '@/lib/db/queries/delivery-cities';
import { MOROCCAN_CITIES } from '@/lib/checkout/data/moroccan-cities';
import { logAuditEvent } from '@/lib/audit/log-event';

/**
 * POST /api/admin/delivery-cities/positions/reset
 *
 * Réinitialise les positions priori à leurs valeurs par défaut.
 * Toutes les villes avec position > 0 qui ne sont pas dans la liste prioritaire
 * sont remises à position = 0.
 */
export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.redirect('/admin/login');
  }

  const defaultPositions = MOROCCAN_CITIES.filter((c) => c.position > 0).map(
    (c) => ({ slug: c.value, position: c.position }),
  );

  const actorId = session.adminId ?? null;

  const result = await updateDeliveryCityPositions(defaultPositions, {
    actorId,
  });

  await logAuditEvent({
    action: 'delivery_cities.reset_positions',
    actorId,
    resourceType: 'delivery_cities',
    meta: { updated: result.updated, notFound: result.notFound },
  });

  return NextResponse.json({
    ...result,
    positions: defaultPositions,
  });
}