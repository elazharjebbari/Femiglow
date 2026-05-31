'use server';

/**
 * Server actions for /admin/emails.
 * - retryOutboxAction : resets a failed/dlq row to pending so the next cron
 *   pickup re-attempts the SMTP send.
 */
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { retryOutbox } from '@/lib/mail/outbox';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';

export async function retryOutboxAction(formData: FormData): Promise<void> {
  const session = await requireAdmin('/admin/emails/transactional');
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  await retryOutbox(id);
  await logAuditEvent({
    action: 'mail.outbox.manual_retry',
    actorId: session.email,
    meta: { outboxId: id },
  });
  logger.info('admin.emails.outbox_retry', { outboxId: id, by: session.email });
  revalidatePath('/admin/emails/transactional');
  revalidatePath(`/admin/emails/transactional/${id}`);
}
