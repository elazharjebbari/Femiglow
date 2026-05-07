import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { gtmConfigStore } from '@/lib/tracking/gtm/config-store';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const v = await gtmConfigStore.get(context.params.id);
    if (!v) throw new HttpError('not_found', 'Configuration introuvable', 404);
    return NextResponse.json(v);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    await gtmConfigStore.remove(context.params.id, { actorId: session.adminId });
    await auditTrackingChange({
      action: 'delete',
      resource: 'tracking_gtm',
      resourceId: context.params.id,
      actorId: session.adminId,
      meta: { config: 'version' },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status: status === 500 ? 400 : status });
  }
}
