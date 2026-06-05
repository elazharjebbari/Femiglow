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
import {
  isLegalTransition,
  syncCampaignStatuses,
  type FemiGlowCampaignStatus,
} from '@/lib/mail/campaigns/listmonk-status-sync';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

/** Relit le payload_json courant d'un brouillon (merge non destructif). */
async function loadPayload(
  drizzle: ReturnType<typeof requireDb>,
  id: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await drizzle
    .select({ payloadJson: emailCampaignLink.payloadJson })
    .from(emailCampaignLink)
    .where(eq(emailCampaignLink.id, id))
    .limit(1);
  return (row?.payloadJson as Record<string, unknown> | undefined) ?? null;
}

// readPayloadTemplateId (UX-CAMP-004) vit dans campaigns-shared.ts : un fichier
// 'use server' ne peut EXPORTER que des fonctions async (refus webpack au build).
import { readPayloadTemplateId } from './campaigns-shared';

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

export type CreateDraftState = { error: string | null };

/**
 * UX-CAMP-009 — variante `useActionState` : capte les erreurs métier (nom
 * invalide, DB non configurée) et les renvoie en état pour un feedback inline,
 * au lieu de laisser Next afficher une page d'erreur générique. Le succès
 * délègue à `createCampaignDraft` (qui redirige). `redirect()` lève une erreur
 * spéciale `NEXT_REDIRECT` qui DOIT remonter telle quelle.
 */
export async function createCampaignDraftAction(
  _prev: CreateDraftState,
  formData: FormData,
): Promise<CreateDraftState> {
  try {
    await createCampaignDraft(formData);
    return { error: null };
  } catch (err) {
    // Laisse passer le redirect interne de Next (succès).
    if (
      err &&
      typeof err === 'object' &&
      'digest' in err &&
      typeof (err as { digest?: unknown }).digest === 'string' &&
      (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
    ) {
      throw err;
    }
    return { error: err instanceof Error ? err.message : 'Création impossible' };
  }
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

  // UX-CAMP-004 — le template Listmonk choisi à l'étape Contenu DOIT être
  // persisté (auparavant accepté par le schéma zod mais JAMAIS écrit → perdu à
  // chaque rechargement, l'edit page le réhydratait à null). La table n'a pas de
  // colonne dédiée : on le range dans `payload_json.listmonkTemplateId`, lu en
  // fallback par finalize et par l'edit page. On fusionne avec le payload fourni
  // (ou existant) pour ne pas écraser `body`.
  if (parsed.payloadJson !== undefined || parsed.listmonkTemplateId !== undefined) {
    const base =
      parsed.payloadJson !== undefined
        ? parsed.payloadJson
        : ((await loadPayload(drizzle, parsed.id)) ?? {});
    set.payloadJson =
      parsed.listmonkTemplateId !== undefined
        ? { ...base, listmonkTemplateId: parsed.listmonkTemplateId }
        : base;
  }

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
      // UX-CAMP-004 — fallback : si l'appelant ne passe pas le template
      // explicitement, on reprend celui persisté dans le payload du draft.
      template_id: parsed.listmonkTemplateId ?? readPayloadTemplateId(draft.payloadJson) ?? undefined,
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

// ─────────────────────────────────────────────────────────────────────────────
// UX-CAMP-001 — Test-send (envoi d'épreuve) depuis l'étape Vérification.
// ─────────────────────────────────────────────────────────────────────────────
const testSendInput = z.object({
  id: z.string().min(1),
  email: z.string().email('Adresse e-mail invalide'),
  subject: z.string().min(1).optional(),
  bodyHtml: z.string().min(1).optional(),
});

export type TestSendResult = { ok: true; email: string } | { ok: false; error: string };

/**
 * Envoie une épreuve de la campagne à une seule adresse via l'API
 * transactionnelle Listmonk. Le test-send réutilise le template Listmonk
 * sélectionné (obligatoire côté `/api/tx`) et passe sujet/corps dans `data`.
 * Aucune mutation de la campagne ni de son statut — c'est une pré-visualisation
 * livrée dans la vraie boîte de l'admin.
 */
export async function sendCampaignTest(
  input: z.infer<typeof testSendInput>,
): Promise<TestSendResult> {
  const session = await requireAdmin('/admin/emails/campaigns');
  const parsed = testSendInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Entrée invalide' };
  }
  const drizzle = requireDb();
  const [draft] = await drizzle
    .select()
    .from(emailCampaignLink)
    .where(eq(emailCampaignLink.id, parsed.data.id))
    .limit(1);
  if (!draft) return { ok: false, error: 'Brouillon introuvable' };

  const templateId =
    readPayloadTemplateId(draft.payloadJson) ??
    null;
  if (templateId == null) {
    return {
      ok: false,
      error:
        "L'envoi de test passe par un template Listmonk : sélectionne-en un à l'étape Contenu avant d'envoyer une épreuve.",
    };
  }

  const subject = parsed.data.subject ?? draft.subject ?? '';
  const body =
    parsed.data.bodyHtml ??
    (draft.payloadJson as { body?: string } | null)?.body ??
    '';

  try {
    // Le destinataire de test doit être un abonné Listmonk connu pour /api/tx.
    await listmonk.subscribers.upsert({ email: parsed.data.email, status: 'enabled' });
    await listmonk.transactional.send({
      subscriber_email: parsed.data.email,
      template_id: templateId,
      data: { subject, body, preheader: draft.preheader ?? '', is_test: true },
    });
  } catch (err) {
    logger.warn('admin.emails.campaign_test_send_failed', {
      draftId: parsed.data.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Échec de l’envoi de test',
    };
  }

  await logAuditEvent({
    action: 'mail.campaign.test_sent',
    actorId: session.email,
    resourceId: parsed.data.id,
    meta: { to: parsed.data.email, templateId },
  });
  return { ok: true, email: parsed.data.email };
}

// ─────────────────────────────────────────────────────────────────────────────
// UX-CAMP-002 — Pause / reprise / annulation d'urgence d'une campagne.
// ─────────────────────────────────────────────────────────────────────────────
type CampaignControl = {
  /** Statut FemiGlow cible après l'action. */
  target: FemiGlowCampaignStatus;
  /** Statut Listmonk à pousser. */
  listmonkStatus: 'paused' | 'running' | 'cancelled';
  action: string;
};

const CONTROLS: Record<'pause' | 'resume' | 'cancel', CampaignControl> = {
  pause: { target: 'paused', listmonkStatus: 'paused', action: 'mail.campaign.paused' },
  resume: { target: 'sending', listmonkStatus: 'running', action: 'mail.campaign.resumed' },
  cancel: { target: 'cancelled', listmonkStatus: 'cancelled', action: 'mail.campaign.cancelled' },
};

async function controlCampaign(kind: 'pause' | 'resume' | 'cancel', formData: FormData): Promise<void> {
  const session = await requireAdmin('/admin/emails/campaigns');
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const drizzle = requireDb();
  const ctrl = CONTROLS[kind];

  const [campaign] = await drizzle
    .select()
    .from(emailCampaignLink)
    .where(eq(emailCampaignLink.id, id))
    .limit(1);
  if (!campaign) throw new Error('Campagne introuvable');

  const from = campaign.status as FemiGlowCampaignStatus;
  // La machine d'états refuse toute transition illégale (ex. pause d'une
  // campagne déjà `sent`, reprise d'une `cancelled`). Garde-fou serveur :
  // l'UI cache déjà les boutons illégaux, mais on ne fait jamais confiance au
  // client pour une opération d'arrêt d'urgence.
  if (!isLegalTransition(from, ctrl.target)) {
    throw new Error(`Transition ${from} → ${ctrl.target} interdite`);
  }

  // Pousse le statut à Listmonk d'abord (la source de vérité de l'envoi).
  if (campaign.listmonkCampaignId != null) {
    await listmonk.campaigns.updateStatus(campaign.listmonkCampaignId, ctrl.listmonkStatus);
  }

  await drizzle
    .update(emailCampaignLink)
    .set({
      status: ctrl.target,
      ...(ctrl.target === 'cancelled' ? { finishedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(emailCampaignLink.id, id));

  await logAuditEvent({
    action: ctrl.action,
    actorId: session.email,
    resourceId: id,
    meta: { from, to: ctrl.target },
  });
  logger.info('admin.emails.campaign_controlled', { id, kind, from, to: ctrl.target, by: session.email });

  revalidatePath('/admin/emails/campaigns');
  revalidatePath(`/admin/emails/campaigns/${id}`);
}

export async function pauseCampaign(formData: FormData): Promise<void> {
  await controlCampaign('pause', formData);
}
export async function resumeCampaign(formData: FormData): Promise<void> {
  await controlCampaign('resume', formData);
}
export async function cancelCampaign(formData: FormData): Promise<void> {
  await controlCampaign('cancel', formData);
}

// ─────────────────────────────────────────────────────────────────────────────
// UX-CAMP-006 — Rafraîchir les métriques (poll Listmonk à la demande).
// ─────────────────────────────────────────────────────────────────────────────
export async function refreshCampaignMetrics(formData: FormData): Promise<void> {
  await requireAdmin('/admin/emails/campaigns');
  const id = String(formData.get('id') ?? '');
  // Le sync est global (poll de toutes les campagnes actives/récentes) ; il
  // englobe l'id courant. On ne fait pas de sync ciblé pour rester aligné sur
  // le cron unique (source de vérité). Échec Listmonk : non bloquant, on
  // revalide quand même (les métriques restent celles du dernier poll).
  try {
    await syncCampaignStatuses();
  } catch (err) {
    logger.warn('admin.emails.campaign_metrics_refresh_failed', {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  revalidatePath('/admin/emails/campaigns');
  if (id) revalidatePath(`/admin/emails/campaigns/${id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// UX-CAMP-003 — Duplication de campagne (relance d'une récurrente).
// ─────────────────────────────────────────────────────────────────────────────
export async function duplicateCampaign(formData: FormData): Promise<void> {
  const session = await requireAdmin('/admin/emails/campaigns');
  const sourceId = String(formData.get('id') ?? '');
  if (!sourceId) return;
  const drizzle = requireDb();

  const [src] = await drizzle
    .select()
    .from(emailCampaignLink)
    .where(eq(emailCampaignLink.id, sourceId))
    .limit(1);
  if (!src) throw new Error('Campagne source introuvable');

  const newId = randomUUID();
  await drizzle.insert(emailCampaignLink).values({
    id: newId,
    name: `${src.name} (copie)`,
    subject: src.subject,
    preheader: src.preheader,
    status: 'draft',
    audienceLinkIds: src.audienceLinkIds,
    audienceId: src.audienceId,
    templateSlug: src.templateSlug,
    payloadJson: src.payloadJson,
    abVariant: src.abVariant,
    createdByUserId: session.email,
    // Volontairement réinitialisés : un nouveau brouillon vierge côté envoi.
    listmonkCampaignId: null,
    scheduledFor: null,
  });

  await logAuditEvent({
    action: 'mail.campaign.duplicated',
    actorId: session.email,
    resourceId: newId,
    meta: { sourceId },
  });
  revalidatePath('/admin/emails/campaigns');
  redirect(`/admin/emails/campaigns/${newId}/edit`);
}
