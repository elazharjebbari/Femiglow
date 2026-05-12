/**
 * CHA-230 — PATCH /api/checkout/lead/[leadId]/payment
 *
 * Step 3 du wizard : persiste la préférence de paiement (`cod`,
 * `bank_transfer`, `card`). Idempotent (scope=payment_select).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { withIdempotency } from '@/lib/checkout/api/idempotency-middleware';
import { errorResponse, mapError, zodErrorResponse } from '@/lib/checkout/api/response';
import { patchLeadPaymentInputSchema } from '@/lib/checkout/schemas/lead';
import { wizardLeadRepo } from '@/lib/checkout/repos/lead-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  context: { params: { leadId: string } },
): Promise<Response> {
  const leadId = context.params.leadId;
  if (!leadId || leadId.length < 4) {
    return errorResponse('invalid_input', 'leadId invalide.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'JSON invalide.');
  }

  const parsed = patchLeadPaymentInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const lead = await wizardLeadRepo.getById(leadId);
    if (!lead) return errorResponse('not_found', 'Lead introuvable.');
    if (!lead.addressCompletedAt) {
      return errorResponse(
        'invalid_state',
        'Adresse non finalisée — étape précédente requise.',
      );
    }

    type PaymentResp =
      | { leadId: string; status: 'payment_selected'; nextStep: 'thank_you' }
      | { error: { code: 'not_found'; message: string } };
    const result = await withIdempotency<PaymentResp>({
      request: req,
      scope: 'payment_select',
      payload: { leadId, ...parsed.data },
      execute: async () => {
        const updated = await wizardLeadRepo.patchPayment(leadId, {
          paymentMethod: parsed.data.paymentMethod,
        });
        if (!updated) {
          return {
            status: 404,
            body: { error: { code: 'not_found' as const, message: 'Lead introuvable.' } },
            resourceId: leadId,
          };
        }
        return {
          status: 200,
          body: {
            leadId: updated.id,
            status: 'payment_selected' as const,
            nextStep: 'thank_you' as const,
          },
          resourceId: updated.id,
        };
      },
    });
    logger.info('checkout.lead.payment.updated', {
      leadId,
      replayed: result.replayed,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    logger.error('checkout.lead.payment.failed', { leadId, error: String(err) });
    return mapError(err);
  }
}
