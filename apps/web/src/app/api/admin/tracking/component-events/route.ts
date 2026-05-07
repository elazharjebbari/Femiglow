import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  listEventsForComponent,
  upsertComponentEvent,
} from '@/lib/db/queries/tracking/component-events';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const upsertSchema = z
  .object({
    componentId: z.string().min(1),
    eventDefinitionId: z.string().min(1),
    enabled: z.boolean().optional(),
    paramsOverride: z.record(z.unknown()).optional(),
    providersOverride: z.array(z.string()).nullable().optional(),
  })
  .strict();

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const componentId = url.searchParams.get('componentId');
    if (!componentId) throw new HttpError('invalid_input', 'componentId requis');
    const events = await listEventsForComponent(componentId);
    return NextResponse.json({ events });
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
    const parsed = upsertSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }
    const ce = await upsertComponentEvent(parsed.data);
    await auditTrackingChange({
      action: parsed.data.enabled === true ? 'enable' : parsed.data.enabled === false ? 'disable' : 'update',
      resource: 'tracking_component_event',
      resourceId: ce.id,
      actorId: session.adminId,
      meta: { componentId: ce.componentId, eventDefinitionId: ce.eventDefinitionId },
    });
    return NextResponse.json({ componentEvent: ce });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
