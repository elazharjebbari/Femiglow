/**
 * OWBS — Service applicatif du lead wizard (couche orchestration).
 *
 * L'API ne contient pas de logique métier : elle délègue ici. `applyLeadCreate`
 * choisit entre :
 *   - chemin **optimiste** (flag ON + leadId client) → upsert-by-leadId idempotent ;
 *   - chemin **legacy** (flag OFF ou pas de leadId) → création serveur (dedup
 *     session+identité), strictement identique au comportement actuel.
 *
 * (P2 ajoutera l'enqueue des effets dans `lead_event_outbox`, dans la même
 * transaction que l'upsert.)
 *
 * @see docs/checkout-leads-background-2026-06-01/01-architecture/architecture.md §3.4
 */
import { env } from '@/lib/env';
import { wizardLeadRepo } from '@/lib/checkout/repos/lead-repo';
import { wizardSessionRepo } from '@/lib/checkout/repos/session-repo';
import {
  createLeadInputSchema,
  patchLeadAddressInputSchema,
  patchLeadPaymentInputSchema,
  type CreateLeadInput,
} from '@/lib/checkout/schemas/lead';
import type { CreateWizardLeadInput } from '@/lib/checkout/repos/lead-repo';

export type BatchScope = 'lead_create' | 'address_update' | 'payment_select';

export interface BatchEnvelope {
  mutationId: string;
  leadId: string;
  scope: BatchScope;
  payload: unknown;
}

export interface BatchItemResult {
  mutationId: string;
  ok: boolean;
  status: 'applied' | 'rejected';
}

/** Le leadId client cible une row appartenant à un AUTRE visiteur. */
export class LeadVisitorMismatchError extends Error {
  constructor(public readonly leadId: string) {
    super('leadId déjà associé à un autre visiteur.');
    this.name = 'LeadVisitorMismatchError';
  }
}

function isOptimisticServerEnabled(): boolean {
  return env.CHECKOUT_OPTIMISTIC_WIZARD_ENABLED === 'true';
}

/** Mappe l'entrée API (Zod) vers l'entrée repo (champs aplatis du formContext). */
function toRepoInput(input: CreateLeadInput): CreateWizardLeadInput {
  return {
    phone: input.phone,
    firstName: input.firstName,
    consentVersion: input.consentVersion,
    language: input.language,
    visitorId: input.visitorId,
    sessionId: input.sessionId,
    formId: input.formContext.formId,
    formMode:
      input.formContext.formMode === 'legacy_cart'
        ? 'legacy_cart'
        : input.formContext.formMode,
    variantKey: input.formContext.variantKey ?? null,
    source: input.formContext.source ?? 'wizard_kit',
    cartSnapshot: input.cartSnapshot,
    page: input.page ?? null,
    referrer: input.referrer ?? null,
    utm: input.utm ?? null,
    gclid: input.gclid ?? null,
    fbp: input.fbp ?? null,
    fbc: input.fbc ?? null,
  };
}

export interface ApplyLeadCreateResult {
  leadId: string;
  /** `true` si le chemin upsert (optimiste) a été emprunté. */
  upserted: boolean;
}

export const leadService = {
  /**
   * Crée (ou complète, en optimiste) un lead wizard. Garantit l'existence de la
   * session (FK), puis branche upsert vs legacy. Idempotent côté upsert.
   */
  async applyLeadCreate(input: CreateLeadInput): Promise<ApplyLeadCreateResult> {
    await wizardSessionRepo.ensureForWizard({
      sessionId: input.sessionId,
      visitorId: input.visitorId,
      language: input.language,
      page: input.page,
      referrer: input.referrer,
      utm: input.utm,
    });

    const fields = toRepoInput(input);

    if (isOptimisticServerEnabled() && input.leadId) {
      // Anti-collision inter-visiteurs : un leadId ne peut pas être détourné
      // vers la row d'un autre visiteur.
      const existing = await wizardLeadRepo.getById(input.leadId);
      if (existing && existing.visitorId !== input.visitorId) {
        throw new LeadVisitorMismatchError(input.leadId);
      }
      const lead = await wizardLeadRepo.upsertWizardLead(input.leadId, fields);
      return { leadId: lead.id, upserted: true };
    }

    const lead = await wizardLeadRepo.createWizardLead(fields);
    return { leadId: lead.id, upserted: false };
  },

  /**
   * OWBS — applique un lot d'envelopes (flush live keepalive OU beacon). Chaque
   * envelope est traitée indépendamment et **idempotemment** (upsert / patch
   * idempotents) ; le désordre est toléré. Une envelope invalide est `rejected`
   * sans faire échouer le reste. cf. ADR-0005 / endpoint /api/checkout/lead/sync.
   */
  async applyBatch(envelopes: BatchEnvelope[]): Promise<BatchItemResult[]> {
    const results: BatchItemResult[] = [];
    for (const env of envelopes) {
      try {
        if (env.scope === 'lead_create') {
          const parsed = createLeadInputSchema.safeParse(env.payload);
          if (!parsed.success) {
            results.push({ mutationId: env.mutationId, ok: false, status: 'rejected' });
            continue;
          }
          await leadService.applyLeadCreate(parsed.data);
        } else if (env.scope === 'address_update') {
          const parsed = patchLeadAddressInputSchema.safeParse(env.payload);
          if (!parsed.success) {
            results.push({ mutationId: env.mutationId, ok: false, status: 'rejected' });
            continue;
          }
          await wizardLeadRepo.patchAddress(env.leadId, {
            city: parsed.data.city,
            addressLine1: parsed.data.addressLine1 ?? '',
            addressLine2: parsed.data.addressLine2 ?? null,
            postalCode: parsed.data.postalCode ?? null,
            country: parsed.data.country,
            notes: parsed.data.notes ?? null,
          });
        } else if (env.scope === 'payment_select') {
          const parsed = patchLeadPaymentInputSchema.safeParse(env.payload);
          if (!parsed.success) {
            results.push({ mutationId: env.mutationId, ok: false, status: 'rejected' });
            continue;
          }
          await wizardLeadRepo.patchPayment(env.leadId, {
            paymentMethod: parsed.data.paymentMethod,
          });
        } else {
          results.push({ mutationId: env.mutationId, ok: false, status: 'rejected' });
          continue;
        }
        results.push({ mutationId: env.mutationId, ok: true, status: 'applied' });
      } catch {
        results.push({ mutationId: env.mutationId, ok: false, status: 'rejected' });
      }
    }
    return results;
  },
};
