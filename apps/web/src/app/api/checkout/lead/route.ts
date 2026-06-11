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
import { leadService, LeadVisitorMismatchError } from '@/lib/checkout/services/lead-service';

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
        // OWBS — délègue au service applicatif. Flag OFF / pas de leadId →
        // chemin legacy (createWizardLead) strictement identique ; flag ON +
        // leadId client → upsert-by-leadId idempotent. cf. lead-service.
        const { leadId } = await leadService.applyLeadCreate(parsed.data);
        return {
          status: 201,
          body: {
            leadId,
            status: 'created' as const,
            nextStep: 'address' as const,
          },
          resourceId: leadId,
        };
      },
    });
    logger.info('checkout.lead.created', {
      leadId: result.resourceId,
      replayed: result.replayed,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    if (err instanceof LeadVisitorMismatchError) {
      logger.warn('checkout.lead.visitor_mismatch', { leadId: err.leadId });
      return errorResponse('invalid_state', 'leadId déjà associé à un autre visiteur.');
    }
    logger.error('checkout.lead.failed', { error: String(err) });
    return mapError(err);
  }
}
