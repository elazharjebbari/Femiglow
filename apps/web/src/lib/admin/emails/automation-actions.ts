'use server';

/**
 * Server actions for the automation admin page.
 *   - toggleAutomationActive : flip active flag
 *   - cancelAutomationRun    : mark a single run as cancelled
 */
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailAutomation, emailAutomationRun } from '@/lib/db/schema-emails';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export async function toggleAutomationActive(formData: FormData): Promise<void> {
  const session = await requireAdmin('/admin/emails/automation');
  const id = String(formData.get('id') ?? '');
  const next = formData.get('next') === 'true';
  if (!id) return;
  const drizzle = requireDb();
  await drizzle
    .update(emailAutomation)
    .set({ active: next, updatedAt: new Date() })
    .where(eq(emailAutomation.id, id));
  await logAuditEvent({
    action: next ? 'mail.automation.activated' : 'mail.automation.deactivated',
    actorId: session.email,
    resourceId: id,
  });
  logger.info('admin.automation.toggle', { id, next, by: session.email });
  revalidatePath('/admin/emails/automation');
}

export async function cancelAutomationRun(formData: FormData): Promise<void> {
  const session = await requireAdmin('/admin/emails/automation');
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const drizzle = requireDb();
  await drizzle
    .update(emailAutomationRun)
    .set({ status: 'cancelled', finishedAt: new Date(), nextActionAt: null })
    .where(eq(emailAutomationRun.id, id));
  await logAuditEvent({
    action: 'mail.automation.run_cancelled',
    actorId: session.email,
    resourceId: id,
  });
  revalidatePath('/admin/emails/automation');
}
