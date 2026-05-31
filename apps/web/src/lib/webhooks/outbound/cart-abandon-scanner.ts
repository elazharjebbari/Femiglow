/**
 * CHA-260 — Scanner des paniers abandonnés (cron tick).
 *
 * Trouve les `chat_lead` éligibles à un webhook `cart.abandoned` et
 * déclenche l'envoi via `dispatchCartAbandonWebhook` pour chacun.
 *
 * Critères d'éligibilité (cf. runbook §2.3) :
 *   - `phone_e164` IS NOT NULL              ← phone-gate matériel
 *   - `purchased_at` IS NULL                ← pas converti
 *   - `abandon_webhook_at` IS NULL          ← anti-doublon strict
 *   - `created_at` < NOW() - 30 minutes     ← seuil d'inaction
 *   - `created_at` > NOW() - 7 jours        ← anti-replay vieux leads
 *
 * Pour chaque lead traité, on stamp `abandon_webhook_at = NOW()` après
 * la tentative (succès OU échec final), garantissant qu'un lead n'est
 * scanné qu'une seule fois.
 *
 * Mode mémoire : ne fait rien (les `chat_lead` ne sont pas en
 * memoryStore — uniquement en Postgres via `chatDb`).
 */
import { and, gt, isNull, lt, sql } from 'drizzle-orm';

import { chatDb } from '@/lib/chat/db/client';
import { chatLead } from '@/lib/chat/db/schema';
import { logger } from '@/lib/logging/logger';

import { dispatchCartAbandonWebhook } from './sources/from-cart-abandon';

export interface ScanCartAbandonOptions {
  /** Limite max de leads scannés par tick. Défaut 50. */
  limit?: number;
  /** Délai d'inactivité requis avant tentative (ms). Défaut 30 min. */
  idleThresholdMs?: number;
  /** TTL anti-replay : on ignore les leads plus vieux que ça. Défaut 7j. */
  maxAgeMs?: number;
}

export interface ScanCartAbandonResult {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
  disabled: number;
  durationMs: number;
}

const DEFAULT_IDLE_MS = 30 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 50;

export async function scanAndDispatchCartAbandon(
  opts: ScanCartAbandonOptions = {},
): Promise<ScanCartAbandonResult> {
  const t0 = Date.now();
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const idleMs = opts.idleThresholdMs ?? DEFAULT_IDLE_MS;
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const cutoffIdle = new Date(Date.now() - idleMs);
  const cutoffMaxAge = new Date(Date.now() - maxAgeMs);

  const db = chatDb();
  if (!db) {
    return {
      scanned: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      disabled: 0,
      durationMs: Date.now() - t0,
    };
  }

  const rows = await db
    .select()
    .from(chatLead)
    .where(
      and(
        sql`${chatLead.phoneE164} is not null`,
        isNull(chatLead.purchasedAt),
        isNull(chatLead.abandonWebhookAt),
        lt(chatLead.createdAt, cutoffIdle),
        gt(chatLead.createdAt, cutoffMaxAge),
      ),
    )
    .limit(limit);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let disabled = 0;

  for (const lead of rows) {
    try {
      const result = await dispatchCartAbandonWebhook(lead);
      if (result.status === 'sent') sent += 1;
      else if (result.status === 'failed') failed += 1;
      else if (result.status === 'skipped') skipped += 1;
      else if (result.status === 'disabled') disabled += 1;

      // Stamp anti-doublon — only stamp on definitive outcomes (not on
      // transient failures, which should be retried on the next tick).
      if (result.status === 'sent' || result.status === 'skipped' || result.status === 'disabled') {
        try {
          await db
            .update(chatLead)
            .set({ abandonWebhookAt: new Date(), updatedAt: new Date() })
            .where(sql`${chatLead.id} = ${lead.id}`);
        } catch (err) {
          logger.error('outbound.webhook.cart-abandon.stamp_error', {
            leadId: lead.id,
            error: String(err),
          });
        }
      }
    } catch (err) {
      failed += 1;
      logger.error('outbound.webhook.cart-abandon.dispatch_error', {
        leadId: lead.id,
        error: String(err),
      });
    }

    // M4 — Trigger cart-abandoned-1h automation (no-op if disabled or no email).
    const leadEmail = (lead as unknown as { email?: string | null }).email;
    if (leadEmail) {
      try {
        const { triggerAutomation } = await import('@/lib/mail/automation/triggers');
        await triggerAutomation(
          'cart-abandoned-1h',
          {
            recipientEmail: leadEmail,
            firstName: lead.firstName,
            cartItemsLabel: '(panier en cours)',
            resumeUrl: 'https://femiglow-maroc.com/panier',
          },
          { dedupeKey: `lead-${lead.id}` },
        );
      } catch (err) {
        logger.error('automation.cart_abandoned.trigger_error', {
          leadId: lead.id,
          error: String(err),
        });
      }
    }
  }

  const durationMs = Date.now() - t0;
  logger.info('outbound.webhook.cart-abandon.scan_completed', {
    scanned: rows.length,
    sent,
    failed,
    skipped,
    disabled,
    durationMs,
  });
  return {
    scanned: rows.length,
    sent,
    failed,
    skipped,
    disabled,
    durationMs,
  };
}
