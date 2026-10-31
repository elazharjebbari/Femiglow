/**
 * PATCH /api/checkout/lead/[leadId]/address/draft
 *
 * Mise à jour de la fiche à chaque champ de l'étape 2 : le panier abandonné
 * porte ainsi la ville et l'adresse déjà saisies. N'est pas une validation
 * d'étape (cf. `wizardLeadRepo.patchAddressDraft`).
 *
 * Répond 200 même si rien n'est écrit : cette sauvegarde est secondaire, et une
 * erreur retentée dans la file ferait attendre la vraie commande derrière elle.
 */
import { type NextRequest, NextResponse } from 'next/server';

import { errorResponse, zodErrorResponse } from '@/lib/checkout/api/response';
import { wizardLeadRepo } from '@/lib/checkout/repos/lead-repo';
import { patchLeadAddressDraftInputSchema } from '@/lib/checkout/schemas/lead';
import { logger } from '@/lib/logging/logger';

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

  const parsed = patchLeadAddressDraftInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const updated = await wizardLeadRepo.patchAddressDraft(leadId, parsed.data);
    return NextResponse.json({ applied: updated !== null });
  } catch (err) {
    logger.warn('checkout.lead.address_draft.failed', { leadId, error: String(err) });
    return NextResponse.json({ applied: false });
  }
}
