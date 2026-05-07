import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { leadNoteSchema } from '@/lib/schemas/admin/lead-filters';
import { getLeadById } from '@/lib/db/queries/leads';
import { createLeadEvent } from '@/lib/db/queries/lead-events';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';

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
    const parsed = leadNoteSchema.safeParse(json);
    if (!parsed.success) throw new HttpError('invalid_input', 'Note invalide');

    const current = await getLeadById(params.id);
    if (!current) throw new HttpError('not_found', 'Lead introuvable');

    const event = await createLeadEvent({
      leadId: params.id,
      type: 'note_added',
      actorId: session.adminId,
      payload: { content: parsed.data.content },
    });
    await logAuditEvent({
      action: 'admin.lead.note_added',
      actorId: session.adminId,
      resourceType: 'lead',
      resourceId: params.id,
      meta: { event_id: event.id },
    });
    return NextResponse.json({ id: event.id, createdAt: event.createdAt.toISOString() });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
