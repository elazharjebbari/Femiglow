import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { processBatch } from '@/lib/webhooks/engine';
import { scanAndDispatchCartAbandon } from '@/lib/webhooks/outbound/cart-abandon-scanner';
import { scanAndDispatchLeadStep1Abandon } from '@/lib/webhooks/outbound/lead-step1-abandon-scanner';
import { syncCampaignStatuses } from '@/lib/mail/campaigns/listmonk-status-sync';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_DURATION_MS = 50_000;
const BATCH_SIZE = 50;
const CART_ABANDON_LIMIT = 30;
const LEAD_STEP1_ABANDON_LIMIT = 50;

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = request.headers.get('authorization');
    const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
    if (!expected || auth !== expected) {
      throw new HttpError('unauthorized', 'Bearer manquant ou invalide');
    }

    const startedAt = Date.now();

    // CHA-260 — Scan des paniers abandonnés AVANT le batch legacy : on
    // garantit que ce job tourne même si processBatch consomme tout le
    // temps disponible. Le scanner est borné à CART_ABANDON_LIMIT leads.
    const cartAbandon = await scanAndDispatchCartAbandon({ limit: CART_ABANDON_LIMIT });
    const leadStep1Abandon = await scanAndDispatchLeadStep1Abandon({
      limit: LEAD_STEP1_ABANDON_LIMIT,
    });

    // Listmonk doesn't emit campaign.completed webhooks; poll instead.
    let campaignSync: Awaited<ReturnType<typeof syncCampaignStatuses>> | { error: string } = {
      checked: 0,
      updated: 0,
      errors: 0,
      durationMs: 0,
    };
    try {
      campaignSync = await syncCampaignStatuses();
    } catch (err) {
      campaignSync = { error: err instanceof Error ? err.message : String(err) };
      logger.warn('cron.tick.campaign_sync_failed', { error: String(err) });
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    while (Date.now() - startedAt < MAX_DURATION_MS) {
      const batch = await processBatch({ limit: BATCH_SIZE });
      processed += batch.processed;
      succeeded += batch.succeeded;
      failed += batch.failed;
      if (batch.processed === 0) break;
    }

    const tookMs = Date.now() - startedAt;
    logger.info('cron.tick.completed', {
      processed,
      succeeded,
      failed,
      took_ms: tookMs,
      cart_abandon: cartAbandon,
      lead_step1_abandon: leadStep1Abandon,
      campaign_sync: campaignSync,
    });
    await logAuditEvent({
      action: 'system.cron_tick',
      actorId: null,
      meta: { processed, succeeded, failed, took_ms: tookMs, cart_abandon: cartAbandon, lead_step1_abandon: leadStep1Abandon, campaign_sync: campaignSync },
    });
    return NextResponse.json({ processed, succeeded, failed, tookMs, cartAbandon, leadStep1Abandon, campaignSync });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
