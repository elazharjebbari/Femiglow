import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { auditMappingChange } from '@/lib/tracking/mappings/audit';
import { buildGtmContainer } from '@/lib/tracking/mappings/gtm-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const exportSchema = z.object({
  env: z.enum(['production', 'stage', 'preview', 'dev']).default('production'),
});

/** POST /api/admin/tracking/events/mappings/[id]/export-gtm */
export async function POST(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const raw = (await request.json().catch(() => ({}))) as unknown;
    const parsed = exportSchema.safeParse(raw);
    if (!parsed.success) throw new HttpError('validation_failed', 'Env invalide');

    const version = await mappingStore.get(params.id);
    if (!version) throw new HttpError('not_found', 'Version introuvable');

    const result = buildGtmContainer({
      mappings: version.mappings,
      env: parsed.data.env,
      containerName: `FemiGlow ${version.name} (${parsed.data.env})`,
    });

    await auditMappingChange({
      versionId: version.id,
      action: 'export_gtm',
      actorId: session.adminId,
      meta: {
        env: parsed.data.env,
        sha256: result.meta.sha256,
        tagsCount: result.meta.tagsCount,
        eventsCount: result.meta.eventsCount,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
