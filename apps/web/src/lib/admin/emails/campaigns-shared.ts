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

/** Extrait l'ID de template Listmonk rangé dans payload_json (UX-CAMP-004). */
export function readPayloadTemplateId(payload: unknown): number | null {
  if (payload && typeof payload === 'object' && 'listmonkTemplateId' in payload) {
    const v = (payload as { listmonkTemplateId?: unknown }).listmonkTemplateId;
    if (typeof v === 'number' && Number.isInteger(v)) return v;
  }
  return null;
}
