/**
 * CHA-308 — Cron quotidien: re-synchronise les sources RAG volatiles
 * (URLs susceptibles de changer). S'appuie sur l'idempotence
 * `raw_hash` de `ragService.ingest` : si le contenu n'a pas bougé,
 * l'ingest est skip et l'embedding n'est pas recalculé.
 *
 * Schedule : `0 5 * * *` (5h UTC quotidien — après intent-recompute 4h).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { isAuthorizedCron } from '@/lib/chat/services/auth-cron';
import { syncKnowledgeSources } from '@/lib/chat/services/kb-sync';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const report = await syncKnowledgeSources();
  logger.info('chat.cron.kb_sync', {
    scanned: report.scanned,
    refreshed: report.refreshed,
    unchanged: report.unchanged,
    errors: report.errors,
  });
  return NextResponse.json(report);
}
