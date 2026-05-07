import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  deleteTrackingPage,
  findTrackingPageById,
  updateTrackingPage,
} from '@/lib/db/queries/tracking/pages';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    category: z.string().min(1).max(64).optional(),
    enabled: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

interface Ctx {
  params: { id: string };
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const page = await findTrackingPageById(ctx.params.id);
    if (!page) throw new HttpError('not_found', 'Page introuvable');
    return NextResponse.json({ page });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const existing = await findTrackingPageById(ctx.params.id);
    if (!existing) throw new HttpError('not_found', 'Page introuvable');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }
    const updated = await updateTrackingPage(ctx.params.id, parsed.data);
    await auditTrackingChange({
      action: 'update',
      resource: 'tracking_page',
      resourceId: updated.id,
      actorId: session.adminId,
      meta: parsed.data,
    });
    return NextResponse.json({ page: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const existing = await findTrackingPageById(ctx.params.id);
    if (!existing) throw new HttpError('not_found', 'Page introuvable');
    await deleteTrackingPage(ctx.params.id);
    await auditTrackingChange({
      action: 'delete',
      resource: 'tracking_page',
      resourceId: ctx.params.id,
      actorId: session.adminId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
