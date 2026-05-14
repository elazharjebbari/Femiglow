/**
 * update_lead step handler — modifie un champ sur le lead (M5.5).
 *
 * Pour V1, on supporte uniquement les champs `status` et `source` sur leads
 * (les seuls modifiables sans casser d'autres invariants).
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { logger } from '@/lib/logging/logger';

export type UpdateLeadStep = {
  kind: 'update_lead';
  field: 'status' | 'source';
  value: string;
};

const ALLOWED_STATUS = ['new', 'contacted', 'qualified', 'converted', 'lost', 'archived'] as const;
type LeadStatus = (typeof ALLOWED_STATUS)[number];

export async function handleUpdateLeadStep(
  step: UpdateLeadStep,
  recipientEmail: string,
): Promise<{ ok: boolean; reason?: string }> {
  const drizzle = getDb();
  if (!drizzle) return { ok: false, reason: 'db_not_configured' };

  const lookup = await drizzle
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.email, recipientEmail.toLowerCase()))
    .limit(1);
  const lead = lookup[0];
  if (!lead) {
    logger.warn('automation.update_lead.skip_no_lead', { recipientEmail });
    return { ok: false, reason: 'no_lead' };
  }

  if (step.field === 'status') {
    if (!(ALLOWED_STATUS as readonly string[]).includes(step.value)) {
      return { ok: false, reason: 'invalid_status' };
    }
    await drizzle
      .update(leads)
      .set({ status: step.value as LeadStatus })
      .where(eq(leads.id, lead.id));
  } else if (step.field === 'source') {
    await drizzle
      .update(leads)
      .set({ source: step.value })
      .where(eq(leads.id, lead.id));
  }
  return { ok: true };
}
