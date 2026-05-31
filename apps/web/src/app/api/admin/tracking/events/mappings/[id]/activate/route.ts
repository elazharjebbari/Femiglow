import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { auditMappingChange } from '@/lib/tracking/mappings/audit';
import { invalidateMappingResolverCache } from '@/lib/tracking/mappings/resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/admin/tracking/events/mappings/[id]/activate */
export async function POST(_req: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const before = await mappingStore.getActive();
    let activated;
    try {
      activated = await mappingStore.activate(params.id, { actorId: session.adminId });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'not_found') throw new HttpError('not_found', 'Version introuvable');
      if (msg === 'version_deleted') throw new HttpError('version_deleted', 'Version supprimée — restaurer d\'abord');
      throw e;
    }
    invalidateMappingResolverCache();
    await auditMappingChange({
      versionId: activated.id,
      action: 'activate',
      actorId: session.adminId,
      before: before ? { id: before.id, name: before.name } : null,
      after: { id: activated.id, name: activated.name },
      meta: { archivedId: before?.id ?? null },
    });
    return NextResponse.json(activated);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
