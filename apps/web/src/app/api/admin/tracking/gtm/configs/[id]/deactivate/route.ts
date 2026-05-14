import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { gtmConfigStore } from '@/lib/tracking/gtm/config-store';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/tracking/gtm/configs/[id]/deactivate
 *
 * Désactive la version courante : state.activeId = null. Une seule version
 * peut être active à la fois ; pour basculer entre deux versions, utiliser
 * /activate sur la nouvelle (auto-désactive l'ancienne).
 */
export async function POST(
  _request: Request,
  context: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    await gtmConfigStore.deactivate(context.params.id, { actorId: session.adminId });
    await auditTrackingChange({
      action: 'update',
      resource: 'tracking_gtm',
      resourceId: context.params.id,
      actorId: session.adminId,
      meta: { config: 'deactivate' },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status: status === 500 ? 400 : status });
  }
}
