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
import { and, eq, isNotNull, sql } from 'drizzle-orm';
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

/** Statuts FemiGlow (miroir de l'enum `email_campaign_status`). */
export type FemiGlowCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'paused'
  | 'cancelled'
  | 'failed';

/**
 * Mapping exhaustif Listmonk → FemiGlow (A-CMP-5). `paused` n'a pas
 * d'équivalent métier côté FemiGlow → on ne touche pas le statut (`null`).
 * Tout statut Listmonk inconnu retourne `null` (no-op défensif).
 */
export function mapListmonkStatus(lmStatus: string): FemiGlowCampaignStatus | null {
  switch (lmStatus) {
    case 'finished':
      return 'sent';
    case 'cancelled':
      return 'cancelled';
    case 'running':
      return 'sending';
    case 'scheduled':
      return 'scheduled';
    case 'paused':
    case 'draft':
    default:
      return null;
  }
}

/**
 * Machine d'états cible (A-CMP-5) — transitions LÉGALES uniquement :
 *
 *   draft → scheduled → sending → sent
 *   draft → sending → sent
 *   (draft|scheduled|sending) → cancelled
 *   sent / cancelled / failed → (terminaux : aucune transition sortante)
 *
 * Un poll/webhook rejoué ne doit JAMAIS régresser un état terminal
 * (`sent → sending`, `cancelled → sending`, `sent → scheduled`).
 */
export function isLegalTransition(
  from: FemiGlowCampaignStatus,
  to: FemiGlowCampaignStatus,
): boolean {
  if (from === to) return true;
  const legal: Record<FemiGlowCampaignStatus, FemiGlowCampaignStatus[]> = {
    draft: ['scheduled', 'sending', 'cancelled', 'failed'],
    scheduled: ['sending', 'cancelled', 'failed'],
    sending: ['sent', 'cancelled', 'failed', 'paused'],
    paused: ['sending', 'cancelled', 'failed'],
    sent: [],
    cancelled: [],
    failed: [],
  };
  return legal[from]?.includes(to) ?? false;
}

export async function syncCampaignStatuses(): Promise<SyncResult> {
  const drizzle = requireDb();
  const start = Date.now();

  // Candidates: active campaigns OR recently-finished campaigns whose metrics
  // are still 0 (Listmonk delivers them post-send, and we don't get a webhook
  // notification, so we need to keep polling for a short window).
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
        sql`(
          ${emailCampaignLink.status} IN ('sending','scheduled')
          OR (
            ${emailCampaignLink.status} = 'sent'
            AND ${emailCampaignLink.finishedAt} > now() - interval '24 hours'
          )
        )`,
      ),
    );

  let updated = 0;
  let errors = 0;

  for (const c of candidates) {
    if (!c.listmonkCampaignId) continue;
    try {
      const res = await listmonk.campaigns.get(c.listmonkCampaignId);
      const lmStatus = res.data.status;

      const next = mapListmonkStatus(lmStatus);
      const now = new Date();

      // Pull metrics from Listmonk regardless of status transition.
      const set: Partial<typeof emailCampaignLink.$inferInsert> = {
        updatedAt: now,
        sentCount: res.data.sent ?? 0,
        openCount: res.data.views ?? 0,
        clickCount: res.data.clicks ?? 0,
        bounceCount: res.data.bounces ?? 0,
      };
      // A-CMP-5 — n'applique la transition de statut que si elle est LÉGALE.
      // Un poll rejoué renvoyant un état obsolète (ex. `running` pour une
      // campagne déjà `sent`) ne doit JAMAIS régresser le statut terminal.
      // Les métriques, elles, restent rafraîchies.
      if (
        next &&
        next !== c.status &&
        isLegalTransition(c.status as FemiGlowCampaignStatus, next)
      ) {
        set.status = next;
        if (next === 'sent') set.finishedAt = now;
      }

      await drizzle
        .update(emailCampaignLink)
        .set(set)
        .where(eq(emailCampaignLink.id, c.id));

      if (set.status) updated += 1;
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
