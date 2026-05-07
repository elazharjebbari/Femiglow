import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { gtmConfigStore } from '@/lib/tracking/gtm/config-store';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  context: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const v = await gtmConfigStore.activate(context.params.id, {
      actorId: session.adminId,
    });
    await auditTrackingChange({
      action: 'enable',
      resource: 'tracking_gtm',
      resourceId: v.id,
      actorId: session.adminId,
      meta: { config: 'version', name: v.name },
    });
    return NextResponse.json(v);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status: status === 500 ? 404 : status });
  }
}
