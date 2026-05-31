/**
 * Bulk actions sur l'outbox (M5.1).
 *
 * - bulkRetry(ids[]) : reset status à 'pending' pour les rows actuellement
 *   en failed/dlq/bounced_soft. Idempotent : retry sur un id déjà 'pending'
 *   est ignoré (skipped).
 * - bulkSuppress(ids[]) : marque les destinataires en suppression list
 *   (hard_bounce manuel ou unsubscribe selon raison).
 *
 * Cf. docs/emailing/admin-evolution/01-data/05-queries-catalog.md
 */
import 'server-only';
import { and, inArray } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailOutbox, emailSuppression } from '@/lib/db/schema-emails';

export type BulkRetryResult = {
  retried: number;
  skipped: number;
  /** Détail des IDs ignorés et la raison (pour audit log + UI feedback). */
  skippedIds: { id: string; reason: 'not_found' | 'wrong_status' }[];
};

export type BulkSuppressResult = {
  suppressed: number;
  skipped: number;
};

const MAX_BULK_SIZE = 500;
const RETRY_ELIGIBLE_STATUSES = ['failed', 'dlq', 'bounced_soft'] as const;

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

/**
 * Reset status='pending' + reset next_action_at sur les rows éligibles.
 * Les rows déjà 'pending'/'sending' ou non trouvées sont skipped.
 */
export async function bulkRetry(ids: string[]): Promise<BulkRetryResult> {
  if (ids.length === 0) {
    return { retried: 0, skipped: 0, skippedIds: [] };
  }
  if (ids.length > MAX_BULK_SIZE) {
    throw new Error(`Bulk retry capped at ${MAX_BULK_SIZE} ids (received ${ids.length})`);
  }
  const drizzle = requireDb();

  // 1. Fetch current statuses to determine eligibility
  const existing = await drizzle
    .select({ id: emailOutbox.id, status: emailOutbox.status })
    .from(emailOutbox)
    .where(inArray(emailOutbox.id, ids));

  const existingMap = new Map(existing.map((r) => [r.id, r.status]));
  const eligibleIds: string[] = [];
  const skippedIds: BulkRetryResult['skippedIds'] = [];

  for (const id of ids) {
    const status = existingMap.get(id);
    if (!status) {
      skippedIds.push({ id, reason: 'not_found' });
    } else if (!(RETRY_ELIGIBLE_STATUSES as readonly string[]).includes(status)) {
      skippedIds.push({ id, reason: 'wrong_status' });
    } else {
      eligibleIds.push(id);
    }
  }

  if (eligibleIds.length === 0) {
    return { retried: 0, skipped: skippedIds.length, skippedIds };
  }

  // 2. Update eligible rows. Reset comme `retryOutbox()` côté lib/mail/outbox.
  await drizzle
    .update(emailOutbox)
    .set({
      status: 'pending',
      attempts: 0,
      nextRetry: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(emailOutbox.id, eligibleIds),
        inArray(emailOutbox.status, [...RETRY_ELIGIBLE_STATUSES]),
      ),
    );

  return { retried: eligibleIds.length, skipped: skippedIds.length, skippedIds };
}

/**
 * Ajoute les destinataires des rows passées en suppression list.
 * Marque aussi les rows outbox en status='suppressed'.
 */
export async function bulkSuppress(
  ids: string[],
  reason: 'manual_admin' | 'hard_bounce' = 'manual_admin',
): Promise<BulkSuppressResult> {
  if (ids.length === 0) {
    return { suppressed: 0, skipped: 0 };
  }
  if (ids.length > MAX_BULK_SIZE) {
    throw new Error(`Bulk suppress capped at ${MAX_BULK_SIZE} ids (received ${ids.length})`);
  }
  const drizzle = requireDb();

  // Récupérer les destinataires des outbox sélectionnés
  const rows = await drizzle
    .select({ id: emailOutbox.id, toEmail: emailOutbox.toEmail })
    .from(emailOutbox)
    .where(inArray(emailOutbox.id, ids));

  if (rows.length === 0) {
    return { suppressed: 0, skipped: ids.length };
  }

  // INSERT en bulk dans email_suppression (ON CONFLICT DO NOTHING)
  await drizzle
    .insert(emailSuppression)
    .values(
      rows.map((r) => ({
        email: r.toEmail.toLowerCase(),
        reason,
        detail: 'bulk_admin_action',
        source: 'manual' as const,
      })),
    )
    .onConflictDoNothing();

  // Mark outbox rows as suppressed
  await drizzle
    .update(emailOutbox)
    .set({ status: 'suppressed' })
    .where(inArray(emailOutbox.id, ids));

  return { suppressed: rows.length, skipped: ids.length - rows.length };
}
