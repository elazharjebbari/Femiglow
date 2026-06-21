/**
 * Constantes et helpers PURS du domaine campagnes, importables côté client
 * COMME côté serveur.
 *
 * Extraits ici (vague 4, fix build) car :
 *  - `campaigns-queries.ts` est `server-only` → un composant 'use client'
 *    (CampaignsListClient) ne peut pas y prendre CAMPAIGN_STATUSES ;
 *  - `wizard-actions.ts` est 'use server' → TOUT export doit y être une
 *    fonction async ; `readPayloadTemplateId` (sync) y était illégal.
 * Les deux modules ré-exportent depuis ici pour la compat.
 */

export const CAMPAIGN_STATUSES = [
  'draft',
  'scheduled',
  'sending',
  'paused',
  'sent',
  'cancelled',
  'failed',
] as const;
export type CampaignStatusFilter = (typeof CAMPAIGN_STATUSES)[number];

/**
 * Rate-limit du test-send (F05-S P3.3-b) — anti-abus : un test-send envoie un
 * VRAI e-mail (et upsert l'adresse comme abonné Listmonk). On borne le débit par
 * admin. Vit ici (pur) car `wizard-actions.ts` est 'use server'.
 */
export const TEST_SEND_RATE_LIMIT = { limit: 10, windowMs: 60_000 } as const;

/** Extrait l'ID de template Listmonk rangé dans payload_json (UX-CAMP-004). */
export function readPayloadTemplateId(payload: unknown): number | null {
  if (payload && typeof payload === 'object' && 'listmonkTemplateId' in payload) {
    const v = (payload as { listmonkTemplateId?: unknown }).listmonkTemplateId;
    if (typeof v === 'number' && Number.isInteger(v)) return v;
  }
  return null;
}

// ── Contrat de l'autosave wizard (F05 P3.2) ─────────────────────────────────
//
// Schéma PUR (vit ici car `wizard-actions.ts` est 'use server' et ne peut
// exporter qu'un async). `expectedRev` = jeton d'optimistic-lock (le `_rev`
// porté dans payload_json) ; tout champ est OPTIONNEL → patch partiel (U-033).
import { z } from 'zod';

export const saveWizardProgressInput = z.object({
  id: z.string().min(1),
  /** Optimistic-lock : doit égaler le `_rev` courant du draft (sinon conflit). */
  expectedRev: z.number().int().nonnegative().optional(),
  wizardStep: z.number().int().min(1).max(6).optional(), // U-034
  name: z.string().min(3).max(120).optional(), // U-035
  subject: z.string().max(140).optional(),
  preheader: z.string().max(200).optional(),
  templateSlug: z.string().nullable().optional(),
  listmonkTemplateId: z.number().int().nullable().optional(),
  audienceLinkIds: z.array(z.number().int()).optional(),
  audienceId: z.string().uuid().nullable().optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
  scheduleTimezone: z.string().max(64).nullable().optional(),
  payloadJson: z.record(z.unknown()).optional(),
});

export type SaveWizardProgressInput = z.infer<typeof saveWizardProgressInput>;

export type SaveWizardResult =
  | { ok: true; rev: number; updatedAt: string }
  | { ok: false; reason: 'not_found' | 'not_draft' | 'conflict' };
