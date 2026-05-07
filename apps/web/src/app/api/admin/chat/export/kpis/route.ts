/**
 * CHA-126 — Export JSON des KPIs (snapshot).
 *
 * Querystring : `window=today|yesterday|7d|30d|90d|all` (défaut 30d).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { adminQueries, type KpiWindow } from '@/lib/chat/admin/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOWS: KpiWindow[] = ['today', 'yesterday', '7d', '30d', '90d', 'all'];

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const w = (req.nextUrl.searchParams.get('window') ?? '30d') as KpiWindow;
  const window = WINDOWS.includes(w) ? w : '30d';

  const kpi = await adminQueries.overviewKpis(window);
  const filename = `chat-kpis-${window}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(kpi, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
