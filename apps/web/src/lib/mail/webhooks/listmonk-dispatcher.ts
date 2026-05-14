/**
 * Dispatch Listmonk webhook events to FemiGlow DB tables.
 *
 *   campaign.started   → UPDATE email_campaign_link SET status='sending', startedAt
 *   campaign.completed → UPDATE email_campaign_link SET status='sent', finishedAt
 *                        + sentCount, openCount, clickCount, bounceCount
 *   subscriber.unsubscribed → UPDATE email_subscriber_link.status='disabled'
 *                             + INSERT email_suppression(reason='unsubscribe')
 *   subscriber.bounced → INSERT email_suppression(reason='hard_bounce')
 *                        + UPDATE email_subscriber_link.status='disabled'
 *   subscriber.complained → INSERT email_suppression(reason='complaint')
 *   subscriber.created  → INSERT email_subscriber_link (best-effort)
 *
 * Listmonk's exact payload shape isn't documented per-event ; we use
 * pickField() helpers to extract what we need defensively.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import {
  emailCampaignLink,
  emailSubscriberLink,
  emailSuppression,
  emailEvent,
} from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';
import type { ListmonkKnownEvent } from './listmonk-parser';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

function pickString(obj: unknown, ...keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function pickNumber(obj: unknown, ...keys: string[]): number | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function pickObject(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return null;
  return (obj as Record<string, unknown>)[key];
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export async function dispatchListmonkEvent(evt: ListmonkKnownEvent): Promise<void> {
  const drizzle = requireDb();
  const data = (evt as { data?: unknown }).data;
  const ts = new Date();

  if (evt.event === 'campaign.started') {
    const lmCampaignId = pickNumber(data, 'id', 'campaign_id');
    if (lmCampaignId == null) {
      logger.warn('mail.webhook.listmonk.campaign_started.missing_id', { evt });
      return;
    }
    await drizzle
      .update(emailCampaignLink)
      .set({ status: 'sending', startedAt: ts, updatedAt: ts })
      .where(eq(emailCampaignLink.listmonkCampaignId, lmCampaignId));
    return;
  }

  if (evt.event === 'campaign.completed') {
    const lmCampaignId = pickNumber(data, 'id', 'campaign_id');
    if (lmCampaignId == null) {
      logger.warn('mail.webhook.listmonk.campaign_completed.missing_id', { evt });
      return;
    }
    await drizzle
      .update(emailCampaignLink)
      .set({
        status: 'sent',
        finishedAt: ts,
        sentCount: pickNumber(data, 'sent') ?? undefined,
        openCount: pickNumber(data, 'views', 'opens') ?? undefined,
        clickCount: pickNumber(data, 'clicks') ?? undefined,
        bounceCount: pickNumber(data, 'bounces') ?? undefined,
        updatedAt: ts,
      })
      .where(eq(emailCampaignLink.listmonkCampaignId, lmCampaignId));
    return;
  }

  if (evt.event === 'subscriber.unsubscribed') {
    // Listmonk may send the subscriber inline OR by id-only ; try email first.
    const sub = pickObject(data, 'subscriber') ?? data;
    const email = pickString(sub, 'email');
    if (!email) {
      logger.warn('mail.webhook.listmonk.unsub.missing_email', { evt });
      return;
    }
    const normalized = normalizeEmail(email);
    await drizzle.transaction(async (tx) => {
      await tx
        .insert(emailSuppression)
        .values({
          email: normalized,
          reason: 'unsubscribe',
          detail: 'listmonk',
          source: 'listmonk',
        })
        .onConflictDoNothing();
      await tx
        .update(emailSubscriberLink)
        .set({ status: 'disabled', unsubscribedAt: ts })
        .where(eq(emailSubscriberLink.email, normalized));
    });
    return;
  }

  if (evt.event === 'subscriber.bounced') {
    const sub = pickObject(data, 'subscriber') ?? data;
    const email = pickString(sub, 'email');
    const bounceType = pickString(data, 'bounce_type', 'type') ?? 'unknown';
    if (!email) {
      logger.warn('mail.webhook.listmonk.bounce.missing_email', { evt });
      return;
    }
    const normalized = normalizeEmail(email);
    await drizzle.transaction(async (tx) => {
      await tx
        .insert(emailSuppression)
        .values({
          email: normalized,
          reason: 'hard_bounce',
          detail: `listmonk:${bounceType}`,
          source: 'listmonk',
        })
        .onConflictDoNothing();
      await tx
        .update(emailSubscriberLink)
        .set({ status: 'blocklisted' })
        .where(eq(emailSubscriberLink.email, normalized));
    });
    return;
  }

  if (evt.event === 'subscriber.complained') {
    const sub = pickObject(data, 'subscriber') ?? data;
    const email = pickString(sub, 'email');
    if (!email) {
      logger.warn('mail.webhook.listmonk.complaint.missing_email', { evt });
      return;
    }
    const normalized = normalizeEmail(email);
    await drizzle
      .insert(emailSuppression)
      .values({
        email: normalized,
        reason: 'complaint',
        detail: 'listmonk',
        source: 'listmonk',
      })
      .onConflictDoNothing();
    return;
  }

  if (evt.event === 'subscriber.created') {
    const email = pickString(data, 'email');
    if (!email) return; // optional event ; ignore silently
    const normalized = normalizeEmail(email);
    const lmId = pickNumber(data, 'id', 'subscriber_id');
    await drizzle
      .insert(emailSubscriberLink)
      .values({
        email: normalized,
        status: 'enabled',
        listmonkSubscriberId: lmId,
        consentSource: 'listmonk',
        consentAt: ts,
        syncedAt: ts,
      })
      .onConflictDoNothing();
    return;
  }

  // subscriber.updated, etc. — append-only audit event in email_event
  await drizzle.insert(emailEvent).values({
    type: 'queued', // generic fallback (no specific enum value for 'updated')
    source: 'listmonk',
    rawJson: evt as unknown as Record<string, unknown>,
  });
}
