/**
 * CHA-230 — PATCH /api/checkout/lead/[leadId]/address
 *
 * Step 2 du wizard : persiste l'adresse de livraison. Idempotent via
 * `Idempotency-Key` (scope=address_update).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { withIdempotency } from '@/lib/checkout/api/idempotency-middleware';
import { errorResponse, mapError, zodErrorResponse } from '@/lib/checkout/api/response';
import { patchLeadAddressInputSchema } from '@/lib/checkout/schemas/lead';
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

  const parsed = patchLeadAddressInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const lead = await wizardLeadRepo.getById(leadId);
    if (!lead) return errorResponse('not_found', 'Lead introuvable.');

    type AddressResp =
      | { leadId: string; status: 'address_completed'; nextStep: 'payment' }
      | { error: { code: 'not_found'; message: string } };
    const result = await withIdempotency<AddressResp>({
      request: req,
      scope: 'address_update',
      payload: { leadId, ...parsed.data },
      execute: async () => {
        const updated = await wizardLeadRepo.patchAddress(leadId, {
          city: parsed.data.city,
          addressLine1: parsed.data.addressLine1 ?? '',
          addressLine2: parsed.data.addressLine2 ?? null,
          postalCode: parsed.data.postalCode ?? null,
          country: parsed.data.country,
          notes: parsed.data.notes ?? null,
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
            status: 'address_completed' as const,
            nextStep: 'payment' as const,
          },
          resourceId: updated.id,
        };
      },
    });
    logger.info('checkout.lead.address.updated', {
      leadId,
      replayed: result.replayed,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    logger.error('checkout.lead.address.failed', { leadId, error: String(err) });
    return mapError(err);
  }
}
