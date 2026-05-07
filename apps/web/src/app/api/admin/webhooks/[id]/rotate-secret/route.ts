import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { rotateWebhookSecret } from '@/lib/db/queries/webhook-endpoints';
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
    const result = await rotateWebhookSecret(params.id).catch(() => null);
    if (!result) throw new HttpError('not_found', 'Endpoint introuvable');
    await logAuditEvent({
      action: 'webhook.secret_rotated',
      actorId: session.adminId,
      resourceType: 'webhook_endpoint',
      resourceId: params.id,
    });
    return NextResponse.json({ id: result.endpoint.id, secret: result.plainSecret });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
