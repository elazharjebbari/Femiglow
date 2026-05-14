/**
 * CHA-230 / CHA-231 — POST /api/checkout/order
 *
 * Finalise une commande issue du wizard. Pré-requis :
 *   - chat_lead existe ET a `address_completed_at`.
 *   - `payment_selected_at` est désormais OPTIONNEL côté UI (CHA-231 a
 *     supprimé le step paiement) — si absent et que la payload contient un
 *     `paymentMethod` valide, le serveur appelle automatiquement
 *     `wizardLeadRepo.patchPayment(...)` AVANT la création d'order pour
 *     respecter l'invariant historique sans casser l'analytics funnel.
 *
 * Flux serveur :
 *   1. Re-valide les prix (product_variants par SKU)
 *   2. Réserve le stock (CAS atomique, rollback si échec)
 *   3. Crée la row `orders` + `order_items`
 *   4. Marque le `chat_lead` comme purchased (purchased_at)
 *
 * Idempotent (scope=order_create).
 *
 * Note : la route existante `/api/checkout` (legacy POST sans wizard)
 * reste opérationnelle — on l'expose ici sur un sous-path dédié pour ne
 * pas casser les intégrations existantes.
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { withIdempotency } from '@/lib/checkout/api/idempotency-middleware';
import { errorResponse, mapError, zodErrorResponse } from '@/lib/checkout/api/response';
import { wizardLeadRepo } from '@/lib/checkout/repos/lead-repo';
import {
  PriceMismatchError,
  StockInsufficientError,
  UnknownSkuError,
  orderRepo,
} from '@/lib/checkout/repos/order-repo';
import { createOrderInputSchema } from '@/lib/checkout/schemas/order';
import { dispatchOrderWebhook } from '@/lib/webhooks/outbound/sources/from-order';
import { sendTransactional } from '@/lib/mail/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'JSON invalide.');
  }

  const parsed = createOrderInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const input = parsed.data;

  try {
    let lead = await wizardLeadRepo.getById(input.leadId);
    if (!lead) return errorResponse('not_found', 'Lead introuvable.');
    if (!lead.addressCompletedAt) {
      return errorResponse('invalid_state', 'Adresse non finalisée.');
    }
    // CHA-231 — tolérance : si le step paiement UI a été shorté, on aligne
    // automatiquement le lead avec la méthode payload (cod par défaut côté
    // wizard). Préserve l'invariant `payment_selected_at NOT NULL` sans
    // imposer un PATCH explicite au client.
    if (!lead.paymentSelectedAt) {
      const patched = await wizardLeadRepo.patchPayment(lead.id, {
        paymentMethod: input.paymentMethod,
      });
      if (!patched || !patched.paymentSelectedAt) {
        return errorResponse('invalid_state', 'Paiement non sélectionné.');
      }
      lead = patched;
      logger.info('checkout.order.payment_auto_selected', {
        leadId: lead.id,
        paymentMethod: input.paymentMethod,
      });
    }

    type OrderResp =
      | {
          orderId: string;
          status: 'created' | 'pending_confirmation';
          totalCents: number;
          currency: string;
        }
      | {
          error: {
            code: 'price_mismatch' | 'stock_insufficient' | 'invalid_input';
            message: string;
            details: unknown;
          };
        };
    const result = await withIdempotency<OrderResp>({
      request: req,
      scope: 'order_create',
      payload: input,
      execute: async () => {
        try {
          const order = await orderRepo.createOrder({
            chatLeadId: lead.id,
            contact: {
              phoneE164: lead.phoneE164,
              firstName: lead.firstName,
              email: lead.email,
              emailConsent: lead.emailConsent,
            },
            items: input.items,
            expectedTotalCents: input.expectedTotalCents,
            currency: input.currency,
            paymentMethod: input.paymentMethod,
            shippingMode: input.shippingMode,
            formContext: {
              formId: input.formContext.formId,
              formMode:
                input.formContext.formMode === 'legacy_cart'
                  ? 'legacy_cart'
                  : input.formContext.formMode,
              variantKey: input.formContext.variantKey ?? null,
            },
          });
          await wizardLeadRepo.markPurchased(lead.id);
          return {
            status: 201,
            body: {
              orderId: order.id,
              status:
                input.paymentMethod === 'cod'
                  ? ('pending_confirmation' as const)
                  : ('created' as const),
              totalCents: order.totalCents,
              currency: order.currency,
            },
            resourceId: order.id,
          };
        } catch (e) {
          if (e instanceof PriceMismatchError) {
            return {
              status: 422,
              body: {
                error: {
                  code: 'price_mismatch' as const,
                  message: e.message,
                  details: e.details,
                },
              },
              resourceId: null,
            };
          }
          if (e instanceof StockInsufficientError) {
            return {
              status: 409,
              body: {
                error: {
                  code: 'stock_insufficient' as const,
                  message: e.message,
                  details: e.details,
                },
              },
              resourceId: null,
            };
          }
          if (e instanceof UnknownSkuError) {
            return {
              status: 400,
              body: {
                error: {
                  code: 'invalid_input' as const,
                  message: e.message,
                  details: e.details,
                },
              },
              resourceId: null,
            };
          }
          throw e;
        }
      },
    });
    logger.info('checkout.order.created', {
      orderId: result.resourceId,
      leadId: input.leadId,
      replayed: result.replayed,
    });

    // CHA-260 — Webhook outbound (fire-and-forget). On ne bloque pas la
    // réponse client : le dispatcher logge la tentative en DB et l'idem-key
    // empêche les doublons (court-circuit si `result.replayed`).
    if (result.resourceId && result.body && !('error' in result.body)) {
      const orderId = result.resourceId;
      const totalCents = (result.body as { totalCents: number }).totalCents;
      const currency = (result.body as { currency: string }).currency;
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        null;
      const leadSnapshot = lead;
      void dispatchOrderWebhook({
        order: { id: orderId, totalCents, currency },
        items: input.items.map((it) => ({
          sku: it.sku,
          name: it.name,
          quantity: it.quantity,
          variantKey: input.formContext.variantKey ?? null,
        })),
        lead: leadSnapshot,
        shippingMode: input.shippingMode,
        paymentMethod: input.paymentMethod,
        ip,
      }).catch((err: unknown) => {
        logger.error('outbound.webhook.order.dispatch_error', {
          orderId,
          error: String(err),
        });
      });

      // M1.B.3 — Confirmation de commande au client (si on a un email).
      // Pas tous les leads ont fourni un email — on tente uniquement si
      // présent. Idempotency : orderId garantit un seul envoi.
      const leadEmail = (leadSnapshot as { email?: string | null }).email ?? null;
      if (leadEmail) {
        const itemsCount = input.items.reduce((s, it) => s + it.quantity, 0);
        const orderTotal = `${(totalCents / 100).toFixed(2)} ${currency}`;
        void sendTransactional({
          template: 'order-confirmation',
          to: { email: leadEmail, name: leadSnapshot.firstName },
          payload: {
            firstName: leadSnapshot.firstName,
            orderId,
            orderTotal,
            itemsCount,
            deliveryEstimate:
              input.shippingMode === 'pickup' ? 'retrait en boutique' : '2-4 jours ouvrés',
          },
          idempotencyKey: `order-confirm:${orderId}`,
          source: 'api.checkout.order',
        }).catch((err: unknown) => {
          logger.error('mail.order_confirmation.dispatch_error', {
            orderId,
            error: String(err),
          });
        });
      }
    }

    return NextResponse.json(result.body, { status: result.status });
  } catch (err) {
    logger.error('checkout.order.failed', { error: String(err) });
    return mapError(err);
  }
}
