/**
 * Listmonk campaign status sync.
 *
 * Listmonk doesn't emit `campaign.completed` webhooks (only bounce/click), so
 * FemiGlow campaigns set to status='sending' stay stuck until something
 * actively polls Listmonk. This module does that polling: for each FemiGlow
 * campaign with a listmonk_campaign_id and a non-terminal status, fetch the
 * Listmonk status and update the mirror.
 *
 * Listmonk → FemiGlow status mapping:
 *   - running   → sending
 *   - finished  → sent   + finishedAt
 *   - cancelled → cancelled
 *   - paused    → (no change)
 *   - scheduled → scheduled
 */
import 'server-only';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailCampaignLink } from '@/lib/db/schema-emails';
import { listmonk } from '@/lib/mail/listmonk/client';
import { logger } from '@/lib/logging/logger';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type SyncResult = {
  checked: number;
  updated: number;
  errors: number;
  durationMs: number;
};

export async function syncCampaignStatuses(): Promise<SyncResult> {
  const drizzle = requireDb();
  const start = Date.now();

  // FemiGlow campaigns that have been pushed to Listmonk and aren't yet in
  // a terminal state.
  const candidates = await drizzle
    .select({
      id: emailCampaignLink.id,
      listmonkCampaignId: emailCampaignLink.listmonkCampaignId,
      status: emailCampaignLink.status,
    })
    .from(emailCampaignLink)
    .where(
      and(
        isNotNull(emailCampaignLink.listmonkCampaignId),
        inArray(emailCampaignLink.status, ['sending', 'scheduled']),
      ),
    );

  let updated = 0;
  let errors = 0;

  for (const c of candidates) {
    if (!c.listmonkCampaignId) continue;
    try {
      const res = await listmonk.campaigns.get(c.listmonkCampaignId);
      const lmStatus = res.data.status;

      let next: 'sent' | 'cancelled' | 'sending' | 'scheduled' | null = null;
      const now = new Date();
      if (lmStatus === 'finished') next = 'sent';
      else if (lmStatus === 'cancelled') next = 'cancelled';
      else if (lmStatus === 'running') next = 'sending';
      else if (lmStatus === 'scheduled') next = 'scheduled';

      if (!next || next === c.status) continue;

      const set: Partial<typeof emailCampaignLink.$inferInsert> = {
        status: next,
        updatedAt: now,
      };
      if (next === 'sent') set.finishedAt = now;

      await drizzle
        .update(emailCampaignLink)
        .set(set)
        .where(eq(emailCampaignLink.id, c.id));

      updated += 1;
      logger.info('listmonk.campaign_status.synced', {
        campaignId: c.id,
        listmonkCampaignId: c.listmonkCampaignId,
        from: c.status,
        to: next,
        sent: res.data.sent,
        toSend: res.data.to_send,
      });
    } catch (err) {
      errors += 1;
      logger.warn('listmonk.campaign_status.sync_failed', {
        campaignId: c.id,
        listmonkCampaignId: c.listmonkCampaignId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const durationMs = Date.now() - start;
  return { checked: candidates.length, updated, errors, durationMs };
}
