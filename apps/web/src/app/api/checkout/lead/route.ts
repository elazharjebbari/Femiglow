/**
 * CHA-230 — POST /api/checkout/lead
 *
 * Step 1 du wizard : crée un `chat_lead` avec consentement. Idempotent
 * via `Idempotency-Key`.
 *
 * Réponse 201 :
 *   {
 *     "leadId": "cl_xxxxxxxx",
 *     "status": "created",
 *     "nextStep": "address"
 *   }
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { withIdempotency } from '@/lib/checkout/api/idempotency-middleware';
import { errorResponse, mapError, zodErrorResponse } from '@/lib/checkout/api/response';
import { createLeadInputSchema } from '@/lib/checkout/schemas/lead';
import { wizardLeadRepo } from '@/lib/checkout/repos/lead-repo';
import { wizardSessionRepo } from '@/lib/checkout/repos/session-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'JSON invalide.');
  }

  const parsed = createLeadInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const result = await withIdempotency({
      request: req,
      scope: 'lead_create',
      payload: parsed.data,
      execute: async () => {
        const input = parsed.data;
        // Garantit l'existence d'une row chat_session (FK chat_lead.session_id).
        // Idempotent : no-op si la session existe déjà.
        await wizardSessionRepo.ensureForWizard({
          sessionId: input.sessionId,
          visitorId: input.visitorId,
          language: input.language,
          page: input.page,
          referrer: input.referrer,
          utm: input.utm,
        });
        const lead = await wizardLeadRepo.createWizardLead({
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
          page: input.page,
          referrer: input.referrer,
          utm: input.utm,
          gclid: input.gclid,
          fbp: input.fbp,
          fbc: input.fbc,
        });
        return {
          status: 201,
          body: {
            leadId: lead.id,
            status: 'created' as const,
            nextStep: 'address' as const,
          },
          resourceId: lead.id,
        };
      },
    });
    logger.info('checkout.lead.created', {
      leadId: result.resourceId,
      replayed: result.replayed,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    logger.error('checkout.lead.failed', { error: String(err) });
    return mapError(err);
  }
}
