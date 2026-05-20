/**
 * POST /api/cron/email-campaign-sync — poll Listmonk for campaigns in
 * non-terminal status and reflect their state in FemiGlow.
 *
 * Listmonk doesn't emit campaign.* webhooks, so campaigns set to
 * status='sending' would otherwise stay stuck forever even after Listmonk
 * has finished sending them. This endpoint reconciles.
 */
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { syncCampaignStatuses } from '@/lib/mail/campaigns/listmonk-status-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const provided = header.slice(7);
  const expected = env.CRON_SECRET;
  if (!expected || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncCampaignStatuses();
    logger.info('cron.email_campaign_sync.completed', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error('cron.email_campaign_sync.failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
