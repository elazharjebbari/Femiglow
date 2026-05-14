/**
 * Health endpoint public — 200 si tout est OK, 503 si un placement publié a
 * un statut != ok dans le dernier snapshot, ou si une page publiée n'a aucun
 * placement visible (orpheline).
 */
import { NextResponse } from 'next/server';

import { summarizeLinkHealth } from '@/lib/legal/link-verifier';
import { pagesWithMissingPlacements } from '@/lib/legal/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const [summary, orphans] = await Promise.all([
      summarizeLinkHealth(),
      pagesWithMissingPlacements(),
    ]);
    const ok = summary.globalStatus === 'ok' && orphans.length === 0;
    const payload = {
      status: ok ? 'ok' : 'degraded',
      globalStatus: summary.globalStatus,
      lastCheckedAt: summary.lastCheckedAt,
      orphanPages: orphans,
      brokenLinks: summary.byZone.flatMap((z) =>
        z.links.filter((l) => l.status !== 'ok').map((l) => ({
          zone: z.zoneKey,
          slug: l.pageSlug,
          status: l.status,
        })),
      ),
    };
    return NextResponse.json(payload, { status: ok ? 200 : 503 });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: (err as Error).message },
      { status: 500 },
    );
  }
}
