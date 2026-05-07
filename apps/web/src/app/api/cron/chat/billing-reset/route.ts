/**
 * CHA-050 — Cron mensuel: reset des compteurs `consumed_month_eur`.
 *
 * À déclencher le 1er de chaque mois (vercel.json: `0 0 1 * *`).
 * Réinitialise les compteurs pour permettre une nouvelle fenêtre de
 * facturation interne. Le coût historique est préservé via
 * `chat_message.cost`.
 */
import { type NextRequest, NextResponse } from 'next/server';

import { isAuthorizedCron } from '@/lib/chat/services/auth-cron';
import { billing } from '@/lib/chat/services/billing';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  await billing.resetMonthlyCounters();
  logger.info('chat.cron.billing_reset', {});
  return NextResponse.json({ ok: true });
}
