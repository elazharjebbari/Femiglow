import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { auditMappingChange } from '@/lib/tracking/mappings/audit';
import { validateMappings, mappingsSchema } from '@/lib/tracking/mappings/validator';
import { DEFAULT_VERSION_ID, type MappingStatus } from '@/lib/tracking/mappings/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/tracking/events/mappings — liste des versions */
export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const statusRaw = url.searchParams.get('status');
    const statusFilter = statusRaw
      ? (statusRaw.split(',').filter(Boolean) as MappingStatus[])
      : undefined;

    const versions = await mappingStore.list({ status: statusFilter });
    const activeId = versions.find((v) => v.isActive)?.id ?? null;
    return NextResponse.json(
      {
        versions,
        activeId,
        defaultId: DEFAULT_VERSION_ID,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const sourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('default') }),
  z.object({ kind: z.literal('clone'), sourceId: z.string().min(1) }),
  z.object({ kind: z.literal('import'), mappings: mappingsSchema }),
]);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable().optional(),
  source: sourceSchema,
});

/** POST /api/admin/tracking/events/mappings — création */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const raw = (await request.json().catch(() => null)) as unknown;
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError('validation_failed', 'Données invalides', parsed.error.flatten());
    }
    const { name, notes, source } = parsed.data;

    let created;
    if (source.kind === 'default') {
      const def = await mappingStore.getDefault();
      if (!def) throw new HttpError('not_found', 'Default version absente');
      created = await mappingStore.clone(
        DEFAULT_VERSION_ID,
        { name, notes: notes ?? null },
        { actorId: session.adminId },
      );
    } else if (source.kind === 'clone') {
      if (source.sourceId === DEFAULT_VERSION_ID) {
        // OK - on autorise le clone depuis default
      }
      try {
        created = await mappingStore.clone(
          source.sourceId,
          { name, notes: notes ?? null },
          { actorId: session.adminId },
        );
      } catch (e) {
        if ((e as Error).message === 'source_not_found') {
          throw new HttpError('not_found', 'Version source introuvable');
        }
        throw e;
      }
    } else {
      const v = validateMappings(source.mappings);
      if (!v.ok) {
        throw new HttpError('validation_failed', 'Mappings invalides', { errors: v.errors });
      }
      created = await mappingStore.create(
        { name, notes: notes ?? null, mappings: source.mappings },
        { actorId: session.adminId },
      );
    }

    await auditMappingChange({
      versionId: created.id,
      action: source.kind === 'clone' ? 'duplicate' : 'create',
      actorId: session.adminId,
      after: { mappings: created.mappings, name: created.name },
      meta: { source: source.kind, sourceId: source.kind === 'clone' ? source.sourceId : null },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
