import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { leadStatusUpdateSchema } from '@/lib/schemas/admin/lead-filters';
import { getLeadById, isValidTransition, updateLeadStatus } from '@/lib/db/queries/leads';
import { createLeadEvent } from '@/lib/db/queries/lead-events';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { enqueueDelivery } from '@/lib/webhooks/engine';
import { listWebhookEndpoints } from '@/lib/db/queries/webhook-endpoints';
import { createId } from '@/lib/ids';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = leadStatusUpdateSchema.safeParse(json);
    if (!parsed.success) throw new HttpError('invalid_input', 'Statut invalide');

    const current = await getLeadById(params.id);
    if (!current) throw new HttpError('not_found', 'Lead introuvable');

    if (!isValidTransition(current.lead.status, parsed.data.status)) {
      throw new HttpError('invalid_state', 'Transition invalide');
    }

    const next = await updateLeadStatus(params.id, parsed.data.status);
    await createLeadEvent({
      leadId: params.id,
      type: 'status_changed',
      actorId: session.adminId,
      payload: { from: current.lead.status, to: parsed.data.status },
    });
    await logAuditEvent({
      action: 'admin.lead.status_changed',
      actorId: session.adminId,
      resourceType: 'lead',
      resourceId: params.id,
      meta: { from: current.lead.status, to: parsed.data.status },
    });
    logger.info('lead.status_changed', {
      lead_id: params.id,
      from: current.lead.status,
      to: parsed.data.status,
    });

    const endpoints = await listWebhookEndpoints();
    for (const ep of endpoints) {
      if (!ep.active) continue;
      if (!ep.events.includes('lead.status_changed')) continue;
      try {
        await enqueueDelivery({
          endpointId: ep.id,
          event: 'lead.status_changed',
          idempotencyKey: createId('idem'),
          payload: {
            lead_id: params.id,
            from: current.lead.status,
            to: parsed.data.status,
          },
        });
      } catch (err) {
        logger.warn('webhook.enqueue.failed', {
          endpoint_id: ep.id,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    return NextResponse.json({ id: next.id, status: next.status });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
