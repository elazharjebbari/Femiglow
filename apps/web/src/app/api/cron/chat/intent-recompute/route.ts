/**
 * CHA-307 — Cron quotidien: rebuild des centroïdes `chat_intent_centroid`
 * à partir de la table `chat_intent_example` (exemples annotés).
 *
 * Le cron rend la cascade vectorielle "vivante" : tout nouvel exemple
 * ajouté via UI/import est reflété dans le centroïde sans intervention
 * humaine.
 *
 * Schedule : `0 4 * * *` (4h UTC quotidien — heure creuse).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { isAuthorizedCron } from '@/lib/chat/services/auth-cron';
import { recomputeAllCentroids } from '@/lib/chat/services/intent-recompute';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const report = await recomputeAllCentroids();
  logger.info('chat.cron.intent_recompute', { ...report });
  return NextResponse.json(report);
}
