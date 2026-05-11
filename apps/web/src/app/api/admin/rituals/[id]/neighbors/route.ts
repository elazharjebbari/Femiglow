import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { getRitualNeighbors } from '@/lib/db/queries/rituals-admin';
import type { RitualStatus } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES: RitualStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'];

function parseStatuses(raw: string | null): RitualStatus[] {
  if (!raw) return ['PENDING'];
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is RitualStatus => (VALID_STATUSES as string[]).includes(s));
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  }
  const url = new URL(request.url);
  const statuses = parseStatuses(url.searchParams.get('status'));
  const result = await getRitualNeighbors(params.id, statuses);
  return NextResponse.json({ data: result });
}
