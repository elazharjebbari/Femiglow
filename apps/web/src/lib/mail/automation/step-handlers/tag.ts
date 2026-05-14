/**
 * tag step handler — add/remove lead_tag (M5.5).
 */
import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { leads, leadTag } from '@/lib/db/schema';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logging/logger';

export type TagStep = {
  kind: 'tag';
  action: 'add' | 'remove';
  tag: string;
};

export async function handleTagStep(
  step: TagStep,
  recipientEmail: string,
  automationSlug: string,
): Promise<{ ok: boolean; reason?: string }> {
  const drizzle = getDb();
  if (!drizzle) return { ok: false, reason: 'db_not_configured' };

  // Lookup lead by email
  const leadRows = await drizzle
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.email, recipientEmail.toLowerCase()))
    .limit(1);
  const lead = leadRows[0];
  if (!lead) {
    logger.warn('automation.tag.skip_no_lead', { recipientEmail });
    return { ok: false, reason: 'no_lead' };
  }

  if (step.action === 'add') {
    await drizzle
      .insert(leadTag)
      .values({
        id: createId('tag'),
        leadId: lead.id,
        tag: step.tag,
        source: 'automation',
        sourceRef: automationSlug,
      })
      .onConflictDoNothing();
  } else {
    await drizzle
      .delete(leadTag)
      .where(and(eq(leadTag.leadId, lead.id), eq(leadTag.tag, step.tag)));
  }

  return { ok: true };
}
