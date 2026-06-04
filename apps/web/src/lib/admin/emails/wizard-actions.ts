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
import { and, eq } from 'drizzle-orm';
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
  audienceLinkIds: z.array(z.number().int()).optional(), // Listmonk list IDs
  audienceId: z.string().uuid().nullable().optional(),    // FemiGlow audience (M5.3)
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
  if (parsed.audienceId !== undefined) set.audienceId = parsed.audienceId;
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

  // ── Préconditions d'audience (AVANT toute mutation/réservation) ──────────
  // M5.4 — si une audience FemiGlow est sélectionnée, snapshot + push à
  // Listmonk pour obtenir un list ID éphémère. Sinon on utilise audienceLinkIds
  // (legacy Listmonk lists choisies directement).
  let listmonkListIds: number[] = draft.audienceLinkIds as number[];
  let snapshotLink: { snapshotId: string; snapshotListmonkListId: number } | null = null;
  if (draft.audienceId) {
    const { snapshotAudience } = await import('@/lib/mail/audiences/snapshot');
    const { pushSnapshotToListmonk } = await import('@/lib/mail/campaigns/listmonk-sync');
    const snap = await snapshotAudience(draft.audienceId, {
      campaignId: parsed.id,
      source: 'campaign',
    });
    const pushed = await pushSnapshotToListmonk(snap.snapshotId);
    if (pushed.pushed === 0) {
      throw new Error(
        `L'audience contient ${snap.size} contact(s) mais 0 a/ont pu être ajouté(s) à Listmonk. Vérifie les logs serveur (event \`listmonk.subscriber.*_failed\`).`,
      );
    }
    listmonkListIds = [pushed.listmonkListId];
    snapshotLink = { snapshotId: snap.snapshotId, snapshotListmonkListId: pushed.listmonkListId };
  }

  if (listmonkListIds.length === 0) throw new Error('Aucune liste ni audience sélectionnée');

  // Sanity : Listmonk reachable
  try {
    listmonk; // noop access to trigger config check at compile time
  } catch (err) {
    if (err instanceof ListmonkConfigError) throw err;
  }

  const nextStatus = (parsed.sendNow
    ? 'sending'
    : draft.scheduledFor
      ? 'scheduled'
      : 'draft') as 'sending' | 'scheduled' | 'draft';

  // ── R-010 — RÉSERVATION ATOMIQUE (anti double-envoi) ──────────────────────
  // Avant tout appel distant qui DÉCLENCHE un envoi de masse, on « claim » le
  // brouillon en une SEULE écriture conditionnelle (`WHERE … status='draft'`).
  // Si 0 ligne n'est touchée, un autre flux (ou un retry après crash) a déjà
  // commencé la finalisation → on rejette SANS rappeler `campaigns.create`.
  // Cette transition draft→sending/scheduled est la clé d'idempotence : un
  // second clic ne peut plus créer une 2e campagne Listmonk (= 2e envoi).
  const claimed = await drizzle
    .update(emailCampaignLink)
    .set({
      status: nextStatus,
      startedAt: parsed.sendNow ? new Date() : null,
      ...(snapshotLink ?? {}),
      updatedAt: new Date(),
    })
    .where(and(eq(emailCampaignLink.id, parsed.id), eq(emailCampaignLink.status, 'draft')))
    .returning();
  if (claimed.length === 0) {
    throw new Error('Statut concurrent : cette campagne ne peut plus être finalisée');
  }

  let lmCampaignId: number;
  try {
    // Create Listmonk campaign
    const createRes = await listmonk.campaigns.create({
      name: draft.name,
      subject: draft.subject,
      lists: listmonkListIds,
      from_email: env.MAIL_FROM,
      body: parsed.bodyHtml,
      content_type: 'html',
      type: 'regular',
      send_at: parsed.sendNow ? null : draft.scheduledFor?.toISOString() ?? null,
      template_id: parsed.listmonkTemplateId,
    });

    lmCampaignId = createRes.data.id;

    // R-010 — Persister l'ID externe IMMÉDIATEMENT après la création, AVANT
    // de démarrer l'envoi. Si `updateStatus` (ou un crash) interrompt le flux
    // ensuite, la campagne Listmonk reste TRACÉE en DB (pas de fantôme non
    // référencé) et le brouillon est déjà `sending` → aucun retry ne pourra
    // recréer une 2e campagne. L'unique index `listmonk_campaign_id` garantit
    // par ailleurs l'absence de double-mirror.
    await drizzle
      .update(emailCampaignLink)
      .set({ listmonkCampaignId: lmCampaignId, updatedAt: new Date() })
      .where(eq(emailCampaignLink.id, parsed.id));
  } catch (err) {
    // La création Listmonk a échoué : aucun envoi n'a démarré (status n'a pas
    // été passé à running). On déréserve pour permettre une nouvelle tentative
    // propre (retour à draft) — pas de campagne fantôme côté Listmonk.
    await drizzle
      .update(emailCampaignLink)
      .set({ status: 'draft', startedAt: null, updatedAt: new Date() })
      .where(and(eq(emailCampaignLink.id, parsed.id), eq(emailCampaignLink.status, nextStatus)));
    throw err;
  }

  // Start or schedule — l'envoi de masse DÉMARRE ici. À ce stade lmCampaignId
  // est déjà persisté : une panne pendant updateStatus laisse une campagne
  // tracée et un brouillon `sending` (retry rejeté), JAMAIS un double envoi.
  if (parsed.sendNow) {
    await listmonk.campaigns.updateStatus(lmCampaignId, 'running');
  } else if (draft.scheduledFor) {
    await listmonk.campaigns.updateStatus(lmCampaignId, 'scheduled');
  }

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
