/**
 * Scanner des leads ayant validé step 1 (nom + téléphone) sans
 * compléter l'adresse dans le délai configurable.
 *
 * Inclut désormais les leads `inline-contact` (conversation) qui ont
 * `leadCapturedAt = NULL` en utilisant `COALESCE(leadCapturedAt, createdAt)`.
 */
import { and, isNull, sql } from 'drizzle-orm';

import { chatDb } from '@/lib/chat/db/client';
import { chatLead } from '@/lib/chat/db/schema';
import { wizardLeadRepo } from '@/lib/checkout/repos/lead-repo';
import { logger } from '@/lib/logging/logger';

import { getLeadWebhookSettings } from './settings';
import { dispatchLeadStep1AbandonWebhook } from './sources/from-wizard-step1-abandon';

export interface ScanLeadStep1AbandonOptions {
  limit?: number;
  now?: Date;
  maxAgeMs?: number;
}

export interface ScanLeadStep1AbandonResult {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
  disabled: number;
  durationMs: number;
  timeoutMinutes: number;
}

const DEFAULT_LIMIT = 50;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function scanAndDispatchLeadStep1Abandon(
  opts: ScanLeadStep1AbandonOptions = {},
): Promise<ScanLeadStep1AbandonResult> {
  const t0 = Date.now();
  const settings = await getLeadWebhookSettings();
  if (!settings.step1AbandonEnabled) {
    return {
      scanned: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      disabled: 1,
      durationMs: Date.now() - t0,
      timeoutMinutes: settings.step1AbandonTimeoutMinutes,
    };
  }

  const db = chatDb();
  if (!db) {
    return {
      scanned: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      disabled: 0,
      durationMs: Date.now() - t0,
      timeoutMinutes: settings.step1AbandonTimeoutMinutes,
    };
  }

  const now = opts.now ?? new Date();
  const cutoffIdle = new Date(now.getTime() - settings.step1AbandonTimeoutMinutes * 60_000);
  const cutoffMaxAge = new Date(now.getTime() - (opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS));

  // COALESCE(leadCapturedAt, createdAt) pour rattraper les leads
  // inline-contact qui n'ont pas leadCapturedAt renseigné.
  // Les paramètres Date doivent être castés en timestamptz explicitement
  // car le driver postgres-js en mode prepare: false ne les convertit pas.
  const rows = await db
    .select()
    .from(chatLead)
    .where(
      and(
        sql`${chatLead.phoneE164} is not null`,
        sql`COALESCE(${chatLead.leadCapturedAt}, ${chatLead.createdAt}) is not null`,
        isNull(chatLead.addressCompletedAt),
        isNull(chatLead.purchasedAt),
        isNull(chatLead.step1AbandonWebhookAt),
        sql`COALESCE(${chatLead.leadCapturedAt}, ${chatLead.createdAt}) < ${cutoffIdle.toISOString()}::timestamptz`,
        sql`COALESCE(${chatLead.leadCapturedAt}, ${chatLead.createdAt}) > ${cutoffMaxAge.toISOString()}::timestamptz`,
      ),
    )
    .limit(opts.limit ?? DEFAULT_LIMIT);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let disabled = 0;

  for (const lead of rows) {
    try {
      const result = await dispatchLeadStep1AbandonWebhook(lead);
      if (result.status === 'sent') sent += 1;
      else if (result.status === 'failed') failed += 1;
      else if (result.status === 'skipped') skipped += 1;
      else if (result.status === 'disabled') disabled += 1;

      // Stamp on sent, skipped, OR disabled to prevent rescanning
      // the same disabled leads every minute.
      if (result.status === 'sent' || result.status === 'skipped' || result.status === 'disabled') {
        try {
          await wizardLeadRepo.stampStep1AbandonWebhook(lead.id);
        } catch (err) {
          logger.error('outbound.webhook.lead-step1-abandon.stamp_error', {
            leadId: lead.id,
            error: String(err),
          });
        }
      }
    } catch (err) {
      failed += 1;
      logger.error('outbound.webhook.lead-step1-abandon.dispatch_error', {
        leadId: lead.id,
        error: String(err),
      });
    }
  }

  const durationMs = Date.now() - t0;
  logger.info('outbound.webhook.lead-step1-abandon.scan_completed', {
    scanned: rows.length,
    sent,
    failed,
    skipped,
    disabled,
    timeoutMinutes: settings.step1AbandonTimeoutMinutes,
    durationMs,
  });

  return {
    scanned: rows.length,
    sent,
    failed,
    skipped,
    disabled,
    durationMs,
    timeoutMinutes: settings.step1AbandonTimeoutMinutes,
  };
}