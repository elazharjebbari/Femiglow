import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { webhookEndpointInputSchema } from '@/lib/schemas/admin/webhook-endpoint';
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
} from '@/lib/db/queries/webhook-endpoints';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const endpoints = await listWebhookEndpoints();
    return NextResponse.json({
      endpoints: endpoints.map((e) => ({
        id: e.id,
        url: e.url,
        events: e.events,
        active: e.active,
        description: e.description,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = webhookEndpointInputSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }
    const created = await createWebhookEndpoint({
      url: parsed.data.url,
      events: parsed.data.events,
      description: parsed.data.description ?? null,
    });
    await logAuditEvent({
      action: 'admin.webhook.created',
      actorId: session.adminId,
      resourceType: 'webhook_endpoint',
      resourceId: created.endpoint.id,
      meta: { url: created.endpoint.url, events: created.endpoint.events },
    });
    return NextResponse.json(
      {
        id: created.endpoint.id,
        url: created.endpoint.url,
        events: created.endpoint.events,
        secret: created.plainSecret,
      },
      { status: 201 },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
