/**
 * CHAT-047 — Cron horaire: surveille les budgets providers individuels.
 *
 * Désactive automatiquement un provider qui dépasse son
 * `quota_monthly_eur` (ratio >= 1.0) et logue un warning quand un provider
 * approche du quota (ratio >= 0.8). Idempotent.
 *
 * Schedule : `0 * * * *` (toutes les heures rondes).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { isAuthorizedCron } from '@/lib/chat/services/auth-cron';
import { watchProviderBudgets } from '@/lib/chat/services/budget-watch';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const report = await watchProviderBudgets();
  logger.info('chat.cron.budget_watch', {
    scanned: report.scanned,
    warned: report.warned,
    disabled: report.disabled,
  });
  return NextResponse.json(report);
}
