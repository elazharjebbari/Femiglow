import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { summarizeLinkHealth } from '@/lib/legal/link-verifier';
import { pagesWithMissingPlacements } from '@/lib/legal/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const [summary, orphanPages] = await Promise.all([
      summarizeLinkHealth(),
      pagesWithMissingPlacements(),
    ]);
    return NextResponse.json({
      globalStatus: orphanPages.length > 0 ? 'warning' : summary.globalStatus,
      lastCheckedAt: summary.lastCheckedAt,
      byZone: summary.byZone,
      orphanPages,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
