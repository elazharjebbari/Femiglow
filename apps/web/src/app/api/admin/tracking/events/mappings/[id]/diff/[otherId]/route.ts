import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { mappingStore } from '@/lib/tracking/mappings/store';
import { PROVIDER_KINDS_FOR_MAPPING, type MappingCell } from '@/lib/tracking/mappings/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DiffItem {
  event: string;
  provider: string;
  before: MappingCell | null;
  after: MappingCell | null;
}

/** GET /api/admin/tracking/events/mappings/[id]/diff/[otherId] */
export async function GET(
  _req: Request,
  { params }: { params: { id: string; otherId: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const [a, b] = await Promise.all([
      mappingStore.get(params.id),
      mappingStore.get(params.otherId),
    ]);
    if (!a || !b) throw new HttpError('not_found', 'Version(s) introuvable(s)');

    const added: DiffItem[] = [];
    const removed: DiffItem[] = [];
    const changed: DiffItem[] = [];
    const allEvents = new Set([...Object.keys(a.mappings), ...Object.keys(b.mappings)]);

    for (const event of allEvents) {
      for (const provider of PROVIDER_KINDS_FOR_MAPPING) {
        const cellA = a.mappings[event]?.[provider] ?? null;
        const cellB = b.mappings[event]?.[provider] ?? null;
        if (cellA === null && cellB === null) continue;
        if (cellA === null && cellB !== null) {
          added.push({ event, provider, before: null, after: cellB });
        } else if (cellA !== null && cellB === null) {
          removed.push({ event, provider, before: cellA, after: null });
        } else if (
          cellA !== null &&
          cellB !== null &&
          (cellA.mappedName !== cellB.mappedName ||
            cellA.isCustom !== cellB.isCustom ||
            cellA.isEnabled !== cellB.isEnabled)
        ) {
          changed.push({ event, provider, before: cellA, after: cellB });
        }
      }
    }

    return NextResponse.json({ added, removed, changed });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
