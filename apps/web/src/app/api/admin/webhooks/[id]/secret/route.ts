import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import {
  revealWebhookSecret,
  setWebhookSecret,
} from '@/lib/db/queries/webhook-endpoints';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const secretInputSchema = z.object({
  secret: z.string().trim().min(8, 'Secret trop court').max(512, 'Secret trop long'),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const secret = await revealWebhookSecret(params.id).catch(() => null);
    if (!secret) throw new HttpError('not_found', 'Endpoint introuvable');
    return NextResponse.json({ id: params.id, secret });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = secretInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Secret invalide', parsed.error.flatten());
    }
    const endpoint = await setWebhookSecret(params.id, parsed.data.secret).catch(() => null);
    if (!endpoint) throw new HttpError('not_found', 'Endpoint introuvable');
    await logAuditEvent({
      action: 'webhook.secret_updated',
      actorId: session.adminId,
      resourceType: 'webhook_endpoint',
      resourceId: endpoint.id,
    });
    return NextResponse.json({ id: endpoint.id, secret: parsed.data.secret });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
