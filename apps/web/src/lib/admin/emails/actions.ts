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

/**
 * État renvoyé par `retryOutboxActionState` (UX-COCKPIT-005). Pilote le feedback
 * role=alert côté client : `ok` distingue succès/échec, `message` est lisible.
 */
export type RetryActionState = {
  ok: boolean | null;
  message: string;
};

export const RETRY_INITIAL_STATE: RetryActionState = { ok: null, message: '' };

/**
 * Variante de `retryOutboxAction` compatible `useFormState` (UX-COCKPIT-005).
 * Au lieu de remonter une erreur en page Next générique (illisible), elle
 * RENVOIE { ok, message } : l'opérateur voit « email remis en file » ou la
 * raison de l'échec, dans un role=alert. Anti double-clic géré côté client via
 * `useFormStatus` (bouton disabled pendant l'action).
 */
export async function retryOutboxActionState(
  _prev: RetryActionState,
  formData: FormData,
): Promise<RetryActionState> {
  let session;
  try {
    session = await requireAdmin('/admin/emails/transactional');
  } catch {
    return { ok: false, message: 'Session expirée ou non autorisée — reconnecte-toi puis réessaie.' };
  }
  const id = String(formData.get('id') ?? '');
  if (!id) {
    return { ok: false, message: 'Identifiant d’envoi manquant.' };
  }

  try {
    await retryOutbox(id);
  } catch (err) {
    logger.error('admin.emails.outbox_retry_failed', { outboxId: id, error: String(err) });
    return {
      ok: false,
      message: `Le renvoi a échoué : ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  await logAuditEvent({
    action: 'mail.outbox.manual_retry',
    actorId: session.email,
    meta: { outboxId: id },
  });
  logger.info('admin.emails.outbox_retry', { outboxId: id, by: session.email });
  revalidatePath('/admin/emails/transactional');
  revalidatePath(`/admin/emails/transactional/${id}`);
  return { ok: true, message: 'Email remis en file — il sera renvoyé au prochain passage du worker.' };
}
