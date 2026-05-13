import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { auditMappingChange } from '@/lib/tracking/mappings/audit';
import { invalidateMappingResolverCache } from '@/lib/tracking/mappings/resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/admin/tracking/events/mappings/reset-default — reset factory */
export async function POST(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const before = await mappingStore.getActive();
    const activated = await mappingStore.resetToDefault({ actorId: session.adminId });
    invalidateMappingResolverCache();
    await auditMappingChange({
      versionId: activated.id,
      action: 'reset_to_default',
      actorId: session.adminId,
      before: before ? { id: before.id, name: before.name } : null,
      after: { id: activated.id, name: activated.name },
      meta: { resetType: 'factory' },
    });
    return NextResponse.json(activated);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
