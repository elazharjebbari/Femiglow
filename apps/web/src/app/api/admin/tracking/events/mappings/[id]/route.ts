import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { auditMappingChange } from '@/lib/tracking/mappings/audit';
import { validateMappings, mappingsSchema } from '@/lib/tracking/mappings/validator';
import { DEFAULT_VERSION_ID } from '@/lib/tracking/mappings/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/tracking/events/mappings/[id] — détail */
export async function GET(_req: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const v = await mappingStore.get(params.id);
    if (!v) throw new HttpError('not_found', 'Version introuvable');
    return NextResponse.json(v, { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const updateSchema = z.object({
  mappings: mappingsSchema,
  name: z.string().min(1).max(120).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

/** PUT /api/admin/tracking/events/mappings/[id] — édition (D-001 clone) */
export async function PUT(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const source = await mappingStore.get(params.id);
    if (!source) throw new HttpError('not_found', 'Version source introuvable');
    if (source.isDefault) throw new HttpError('cannot_edit_default', 'La version __default__ est en lecture seule');

    const raw = (await request.json().catch(() => null)) as unknown;
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError('validation_failed', 'Données invalides', parsed.error.flatten());
    }
    const v = validateMappings(parsed.data.mappings);
    if (!v.ok) {
      throw new HttpError('validation_failed', 'Mappings invalides', { errors: v.errors });
    }

    const created = await mappingStore.editAsClone(
      params.id,
      {
        mappings: parsed.data.mappings,
        name: parsed.data.name,
        notes: parsed.data.notes,
      },
      { actorId: session.adminId },
    );

    await auditMappingChange({
      versionId: created.id,
      action: 'edit',
      actorId: session.adminId,
      before: { mappings: source.mappings },
      after: { mappings: created.mappings },
      meta: { sourceId: params.id, newId: created.id },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

/** DELETE /api/admin/tracking/events/mappings/[id] — soft-delete */
export async function DELETE(_req: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    if (params.id === DEFAULT_VERSION_ID) {
      throw new HttpError('cannot_delete_default', 'La version __default__ ne peut pas être supprimée');
    }
    try {
      await mappingStore.softDelete(params.id, { actorId: session.adminId });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'not_found') throw new HttpError('not_found', 'Version introuvable');
      if (msg === 'cannot_delete_active') throw new HttpError('cannot_delete_active', 'Impossible de supprimer la version active');
      if (msg === 'cannot_delete_default') throw new HttpError('cannot_delete_default', 'Impossible de supprimer le default');
      throw e;
    }
    await auditMappingChange({
      versionId: params.id,
      action: 'delete',
      actorId: session.adminId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
