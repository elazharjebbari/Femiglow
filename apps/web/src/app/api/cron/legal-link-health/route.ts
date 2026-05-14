/**
 * Cron quotidien — vérifie tous les placements legal_page_placements visibles.
 * Insère un snapshot par lien dans `legal_link_health_snapshot`, puis purge
 * les snapshots > 30 jours.
 *
 * Schedule : 0 3 * * * (Vercel cron, cf. vercel.json)
 * Auth     : Bearer <CRON_SECRET>
 */
import { type NextRequest, NextResponse } from 'next/server';

import { isAuthorizedCron } from '@/lib/chat/services/auth-cron';
import { env } from '@/lib/env';
import {
  checkLinkOverHttp,
  classifyLink,
  gatherPlacementsToCheck,
  purgeOldSnapshots,
  recordSnapshots,
} from '@/lib/legal/link-verifier';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const started = Date.now();
  const targets = await gatherPlacementsToCheck();
  if (targets.length === 0) {
    logger.info('legal.cron.link_health', { targets: 0 });
    return NextResponse.json({ ok: true, checked: 0 });
  }

  const baseUrl = env.NEXT_PUBLIC_SITE_URL;
  const results = await Promise.all(
    targets.map((t) => (baseUrl ? checkLinkOverHttp(baseUrl, t) : classifyLink(t))),
  );
  const inserted = await recordSnapshots(results);
  const purged = await purgeOldSnapshots(30);

  const durationMs = Date.now() - started;
  const broken = results.filter((r) => r.status !== 'ok').length;
  logger.info('legal.cron.link_health', {
    targets: results.length,
    inserted,
    purged,
    broken,
    duration_ms: durationMs,
  });

  return NextResponse.json({
    ok: true,
    checked: results.length,
    inserted,
    broken,
    purged,
    duration_ms: durationMs,
  });
}
