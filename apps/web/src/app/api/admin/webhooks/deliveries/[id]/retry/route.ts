import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { getDelivery } from '@/lib/db/queries/webhook-deliveries';
import { attemptDelivery } from '@/lib/webhooks/engine';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const delivery = await getDelivery(params.id);
    if (!delivery) throw new HttpError('not_found', 'Livraison introuvable');
    if (delivery.status === 'in_progress') {
      throw new HttpError('conflict', 'Une tentative est déjà en cours');
    }
    const result = await attemptDelivery(delivery);
    await logAuditEvent({
      action: 'webhook.delivery_retried',
      actorId: session.adminId,
      resourceType: 'webhook_delivery',
      resourceId: result.id,
      meta: {
        endpoint_id: result.endpointId,
        status: result.status,
        response_status: result.responseStatus,
      },
    });
    return NextResponse.json({
      id: result.id,
      status: result.status,
      attemptCount: result.attemptCount,
      responseStatus: result.responseStatus,
      responseBody: result.responseBody,
      errorCode: result.errorCode,
      nextAttemptAt: result.nextAttemptAt?.toISOString() ?? null,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
