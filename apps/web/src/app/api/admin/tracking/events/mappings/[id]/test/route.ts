import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { auditMappingChange } from '@/lib/tracking/mappings/audit';
import { PROVIDER_KINDS_FOR_MAPPING, type TestDispatchResult } from '@/lib/tracking/mappings/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const testSchema = z.object({
  eventName: z.string().min(1).max(80),
  params: z.record(z.unknown()).optional(),
});

/** POST /api/admin/tracking/events/mappings/[id]/test — dry-run dispatch */
export async function POST(request: Request, { params }: { params: { id: string } }): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const raw = (await request.json().catch(() => null)) as unknown;
    const parsed = testSchema.safeParse(raw);
    if (!parsed.success) throw new HttpError('validation_failed', 'Body invalide');

    const version = await mappingStore.get(params.id);
    if (!version) throw new HttpError('not_found', 'Version introuvable');

    const results: Record<string, TestDispatchResult> = {};
    for (const kind of PROVIDER_KINDS_FOR_MAPPING) {
      const cell = version.mappings[parsed.data.eventName]?.[kind];
      if (!cell) {
        results[kind] = {
          providerKind: kind,
          wouldDispatch: false,
          mappedName: null,
          isCustom: false,
          skipReason: 'no_mapping',
        };
        continue;
      }
      if (!cell.isEnabled) {
        results[kind] = {
          providerKind: kind,
          wouldDispatch: false,
          mappedName: cell.mappedName,
          isCustom: cell.isCustom,
          skipReason: 'disabled',
        };
        continue;
      }
      if (!cell.mappedName) {
        results[kind] = {
          providerKind: kind,
          wouldDispatch: false,
          mappedName: null,
          isCustom: false,
          skipReason: 'mapped_name_null',
        };
        continue;
      }
      results[kind] = {
        providerKind: kind,
        wouldDispatch: true,
        mappedName: cell.mappedName,
        isCustom: cell.isCustom,
        skipReason: null,
      };
    }

    await auditMappingChange({
      versionId: version.id,
      action: 'test_event',
      actorId: session.adminId,
      meta: { eventName: parsed.data.eventName, results },
    });

    return NextResponse.json({ results });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
