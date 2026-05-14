'use server';

/**
 * Server actions for the campaign wizard.
 *
 *   - createCampaignDraft : INSERT email_campaign_link with status='draft'
 *   - updateCampaignDraft : partial UPDATE on a draft
 *   - finalizeCampaign    : create the Listmonk campaign + schedule/start it,
 *                           transition status to 'scheduled' or 'sending'
 *   - discardCampaign     : delete a draft (status=cancelled)
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db as getDb } from '@/lib/db/client';
import { emailCampaignLink } from '@/lib/db/schema-emails';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listmonk, ListmonkConfigError } from '@/lib/mail/listmonk/client';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { logAuditEvent } from '@/lib/audit/log-event';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

const createDraftInput = z.object({
  name: z.string().min(3).max(120),
});

export async function createCampaignDraft(formData: FormData): Promise<void> {
  const session = await requireAdmin('/admin/emails/campaigns/new');
  const parsed = createDraftInput.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    throw new Error('Nom invalide (3-120 caractères)');
  }
  const id = randomUUID();
  const drizzle = requireDb();
  await drizzle.insert(emailCampaignLink).values({
    id,
    name: parsed.data.name,
    subject: '',
    status: 'draft',
    audienceLinkIds: [],
    payloadJson: {},
    createdByUserId: session.email,
  });
  await logAuditEvent({
    action: 'mail.campaign.draft_created',
    actorId: session.email,
    resourceId: id,
    meta: { name: parsed.data.name },
  });
  revalidatePath('/admin/emails/campaigns');
  redirect(`/admin/emails/campaigns/${id}/edit`);
}

const updateDraftInput = z.object({
  id: z.string().min(1),
  name: z.string().min(3).max(120).optional(),
  subject: z.string().max(140).optional(),
  preheader: z.string().max(200).optional(),
  templateSlug: z.string().nullable().optional(),
  listmonkTemplateId: z.number().int().nullable().optional(),
  audienceLinkIds: z.array(z.number().int()).optional(), // store Listmonk list IDs directly
  scheduledFor: z.string().datetime().nullable().optional(),
  payloadJson: z.record(z.unknown()).optional(),
});

export async function updateCampaignDraft(input: z.infer<typeof updateDraftInput>): Promise<void> {
  await requireAdmin('/admin/emails/campaigns');
  const parsed = updateDraftInput.parse(input);
  const drizzle = requireDb();
  const set: Partial<typeof emailCampaignLink.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.name !== undefined) set.name = parsed.name;
  if (parsed.subject !== undefined) set.subject = parsed.subject;
  if (parsed.preheader !== undefined) set.preheader = parsed.preheader;
  if (parsed.templateSlug !== undefined) set.templateSlug = parsed.templateSlug;
  if (parsed.audienceLinkIds !== undefined) set.audienceLinkIds = parsed.audienceLinkIds;
  if (parsed.scheduledFor !== undefined) {
    set.scheduledFor = parsed.scheduledFor ? new Date(parsed.scheduledFor) : null;
  }
  if (parsed.payloadJson !== undefined) set.payloadJson = parsed.payloadJson;

  await drizzle.update(emailCampaignLink).set(set).where(eq(emailCampaignLink.id, parsed.id));
}

const finalizeInput = z.object({
  id: z.string().min(1),
  sendNow: z.boolean(),
  // Optional Listmonk template ID. If absent, body/subject come from draft.
  listmonkTemplateId: z.number().int().optional(),
  bodyHtml: z.string().min(1),
});

export async function finalizeCampaign(input: z.infer<typeof finalizeInput>): Promise<{ campaignId: number }> {
  const session = await requireAdmin('/admin/emails/campaigns');
  const parsed = finalizeInput.parse(input);
  const drizzle = requireDb();

  // Load draft
  const [draft] = await drizzle
    .select()
    .from(emailCampaignLink)
    .where(eq(emailCampaignLink.id, parsed.id))
    .limit(1);
  if (!draft) throw new Error('Brouillon introuvable');
  if (draft.status !== 'draft') throw new Error(`Statut ${draft.status} : cette campagne ne peut plus être finalisée`);
  if (!draft.subject) throw new Error('Sujet manquant');
  if ((draft.audienceLinkIds as number[]).length === 0) throw new Error('Aucune liste sélectionnée');

  // Sanity : Listmonk reachable
  try {
    listmonk; // noop access to trigger config check at compile time
  } catch (err) {
    if (err instanceof ListmonkConfigError) throw err;
  }

  // Create Listmonk campaign
  const createRes = await listmonk.campaigns.create({
    name: draft.name,
    subject: draft.subject,
    lists: draft.audienceLinkIds as number[],
    from_email: env.MAIL_FROM,
    body: parsed.bodyHtml,
    content_type: 'html',
    type: 'regular',
    send_at: parsed.sendNow ? null : draft.scheduledFor?.toISOString() ?? null,
    template_id: parsed.listmonkTemplateId,
  });

  const lmCampaignId = createRes.data.id;

  // Start or schedule
  if (parsed.sendNow) {
    await listmonk.campaigns.updateStatus(lmCampaignId, 'running');
  } else if (draft.scheduledFor) {
    await listmonk.campaigns.updateStatus(lmCampaignId, 'scheduled');
  }

  // Mirror in FemiGlow
  const nextStatus = (parsed.sendNow
    ? 'sending'
    : draft.scheduledFor
      ? 'scheduled'
      : 'draft') as 'sending' | 'scheduled' | 'draft';
  await drizzle
    .update(emailCampaignLink)
    .set({
      listmonkCampaignId: lmCampaignId,
      status: nextStatus,
      startedAt: parsed.sendNow ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(emailCampaignLink.id, parsed.id));

  await logAuditEvent({
    action: 'mail.campaign.finalized',
    actorId: session.email,
    resourceId: parsed.id,
    meta: { listmonkCampaignId: lmCampaignId, sendNow: parsed.sendNow, status: nextStatus },
  });

  logger.info('admin.emails.campaign_finalized', {
    draftId: parsed.id,
    listmonkCampaignId: lmCampaignId,
    sendNow: parsed.sendNow,
    by: session.email,
  });

  revalidatePath('/admin/emails/campaigns');
  revalidatePath(`/admin/emails/campaigns/${parsed.id}`);
  return { campaignId: lmCampaignId };
}

export async function discardCampaign(formData: FormData): Promise<void> {
  const session = await requireAdmin('/admin/emails/campaigns');
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const drizzle = requireDb();
  await drizzle
    .update(emailCampaignLink)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(emailCampaignLink.id, id));
  await logAuditEvent({
    action: 'mail.campaign.cancelled',
    actorId: session.email,
    resourceId: id,
  });
  revalidatePath('/admin/emails/campaigns');
  redirect('/admin/emails/campaigns');
}
