/**
 * CHA-230 — PATCH /api/checkout/order/[orderId]/email
 *
 * Step 4 (thank-you) : opt-in email marketing après commande. Le user
 * doit avoir explicitement coché la case (`emailConsent=true`).
 *
 * Met à jour :
 *   - `chat_lead.email`, `chat_lead.email_consent`
 *   - le `leads` legacy row si elle existe (synchronisation)
 *
 * Idempotent (scope=email_optin).
 */
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db/client';
import { leads, leadTag, orders } from '@/lib/db/schema';
import { logger } from '@/lib/logging/logger';
import { withIdempotency } from '@/lib/checkout/api/idempotency-middleware';
import { errorResponse, mapError, zodErrorResponse } from '@/lib/checkout/api/response';
import { wizardLeadRepo } from '@/lib/checkout/repos/lead-repo';
import { DbUnavailableError } from '@/lib/checkout/repos/idempotency-repo';
import { optInEmailInputSchema } from '@/lib/checkout/schemas/lead';
import { insertUserEventSafe } from '@/lib/user-events/insert';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  context: { params: { orderId: string } },
): Promise<Response> {
  const orderId = context.params.orderId;
  if (!orderId || orderId.length < 4) {
    return errorResponse('invalid_input', 'orderId invalide.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'JSON invalide.');
  }

  const parsed = optInEmailInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const input = parsed.data;

  try {
    const conn = db();
    if (!conn) throw new DbUnavailableError();
    const orderRows = await conn
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    const order = orderRows[0];
    if (!order) return errorResponse('not_found', 'Commande introuvable.');
    if (!order.chatLeadId) {
      return errorResponse('invalid_state', 'Commande non liée à un lead wizard.');
    }

    type EmailResp =
      | { orderId: string; email: string; status: 'email_optin_saved' }
      | { error: { code: 'not_found'; message: string } };
    const result = await withIdempotency<EmailResp>({
      request: req,
      scope: 'email_optin',
      payload: { orderId, ...input },
      execute: async () => {
        const lead = await wizardLeadRepo.optInEmail(order.chatLeadId!, {
          email: input.email,
          emailConsent: input.emailConsent,
        });
        if (!lead) {
          return {
            status: 404,
            body: {
              error: { code: 'not_found' as const, message: 'Lead introuvable.' },
            },
            resourceId: null,
          };
        }
        // Synchronise le legacy `leads` (UPDATE par id).
        await conn
          .update(leads)
          .set({
            email: input.email.trim().toLowerCase(),
            consentMarketing: true,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, order.leadId));

        // Tag automatique `post-purchase-optin` (idempotent par
        // (leadId, tag)). Permet de cibler ces leads via une audience
        // (has_tag = 'post-purchase-optin') ou de fire une automation
        // sur trigger = event lead.email_optin_post_purchase.
        // DRIFT FIX (chantier 1.1) — `lead_tag.id` est `uuid DEFAULT
        // gen_random_uuid()` côté DB : on laisse la base générer l'id (ne PAS
        // passer `createId('tag')`, qui n'est pas un uuid → crash 500).
        await conn
          .insert(leadTag)
          .values({
            leadId: order.leadId,
            tag: 'post-purchase-optin',
            source: 'automation',
            sourceRef: `checkout:${orderId}`,
          })
          .onConflictDoNothing();

        // Émet un user_event pour les triggers d'automation.
        await insertUserEventSafe({
          email: input.email,
          eventName: 'lead.email_optin_post_purchase',
          source: 'server',
          leadId: order.leadId,
          properties: { orderId },
        });
        return {
          status: 200,
          body: {
            orderId,
            email: input.email,
            status: 'email_optin_saved' as const,
          },
          resourceId: orderId,
        };
      },
    });
    logger.info('checkout.order.email.opt-in', {
      orderId,
      replayed: result.replayed,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    logger.error('checkout.order.email.failed', { orderId, error: String(err) });
    return mapError(err);
  }
}
