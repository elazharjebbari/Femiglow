/**
 * CHA-230 — Repository orders (création finale wizard).
 *
 * Crée :
 *   1. Une row `leads` (legacy) synthétique liée par téléphone (placeholder
 *      email si pas d'opt-in marketing).
 *   2. Une row `orders` reliée à `chat_lead` (via chat_lead_id) + au
 *      `leads` legacy.
 *   3. Les `order_items` correspondants.
 *
 * Garanties :
 *   - Vérifie les prix serveur vs `expectedTotalCents` (re-fetch
 *     product_variants par SKU).
 *   - Réserve atomiquement le stock (CAS) ; rollback si l'une des
 *     réservations échoue.
 *
 * Ne touche PAS la confirmation paiement — c'est le job de Stripe webhook
 * ou du back-office (changement de `orders.status`).
 */
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  leads,
  orderItems,
  orders,
  productVariants,
  products,
} from '@/lib/db/schema';
import { createId } from '@/lib/ids';

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof orderItems.$inferSelect;

import { DbUnavailableError } from './idempotency-repo';
import { stockRepo, type StockSnapshot } from './stock-repo';

function requireDb(): NonNullable<ReturnType<typeof db>> {
  const conn = db();
  if (!conn) throw new DbUnavailableError();
  return conn;
}

export type OrderRowOut = OrderRow & { items: OrderItemRow[] };

export class PriceMismatchError extends Error {
  readonly details: {
    expectedTotalCents: number;
    computedTotalCents: number;
  };
  constructor(expected: number, computed: number) {
    super(
      `Total reçu (${expected}) différent du total recalculé (${computed}).`,
    );
    this.name = 'PriceMismatchError';
    this.details = { expectedTotalCents: expected, computedTotalCents: computed };
  }
}

export class StockInsufficientError extends Error {
  readonly details: { variantId: string; sku: string; requested: number };
  constructor(variantId: string, sku: string, requested: number) {
    super(`Stock insuffisant pour ${sku} (${requested} demandé).`);
    this.name = 'StockInsufficientError';
    this.details = { variantId, sku, requested };
  }
}

export class UnknownSkuError extends Error {
  readonly details: { sku: string };
  constructor(sku: string) {
    super(`SKU inconnu : ${sku}`);
    this.name = 'UnknownSkuError';
    this.details = { sku };
  }
}

export interface CreateOrderInput {
  chatLeadId: string;
  /** Synthese du `chat_lead` côté domaine — pour bâtir le legacy `leads`. */
  contact: {
    phoneE164: string;
    firstName: string;
    email?: string | null;
    emailConsent?: boolean;
  };
  items: Array<{ sku: string; name: string; quantity: number; unitPriceCents: number }>;
  expectedTotalCents: number;
  currency: string;
  paymentMethod: 'cod' | 'bank_transfer' | 'card';
  shippingMode: 'standard' | 'express' | 'pickup';
  formContext: {
    formId: string;
    formMode: 'wizard_embed' | 'wizard_cart' | 'legacy_cart';
    variantKey?: 'A' | 'B' | 'control' | null;
  };
  /**
   * Contexte coupon reconstruit depuis la requête (mêmes primitives que
   * l'affichage → même bucket → prix facturé == prix affiché). Optionnel :
   * absent (legacy) → contexte vide (treatment, éligibilité tout-trafic).
   */
  couponContext?: import('@/lib/coupons/types').CouponContext;
  /**
   * Code de crédit fidélité (Phase 3) saisi par le client. S'il est valide,
   * il se cumule sur le prix d'accueil (réduction additionnelle plafonnée) et
   * est consommé (redeemed) à la création de la commande.
   */
  couponCode?: string | null;
}

/**
 * Résout un legacy `leads.id` à partir du chat_lead :
 *   - Si l'utilisateur a opt-in email → on cherche par email puis insère.
 *   - Sinon → on construit un email synthétique non-routable
 *     `<phoneE164>@phone.femiglow.local` pour satisfaire le FK.
 */
async function resolveLegacyLeadId(
  contact: CreateOrderInput['contact'],
): Promise<string> {
  const conn = requireDb();
  const email =
    contact.email ?? `${contact.phoneE164}@phone.femiglow.local`;
  const existing = await conn
    .select()
    .from(leads)
    .where(eq(leads.email, email))
    .limit(1);
  if (existing[0]) {
    await conn
      .update(leads)
      .set({
        phone: contact.phoneE164,
        name: contact.firstName,
        status: 'converted',
        source: 'wizard',
        consentMarketing: contact.emailConsent ?? false,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, existing[0].id));
    return existing[0].id;
  }

  const id = createId('lead');
  await conn.insert(leads).values({
    id,
    email,
    phone: contact.phoneE164,
    name: contact.firstName,
    status: 'converted',
    source: 'wizard',
    consentMarketing: contact.emailConsent ?? false,
  });
  return id;
}

export const orderRepo = {
  async createOrder(input: CreateOrderInput): Promise<OrderRowOut> {
    const conn = requireDb();

    // 1. Re-vérifie les prix serveur — récupère chaque variant par SKU.
    //    CHA-233 — Fallback : si l'item porte un `sku` qui n'existe pas en
    //    DB (cart legacy avec slug produit en guise de SKU, e.g. "kit"),
    //    on tente une résolution via `products.slug` → primary variant.
    const skus = input.items.map((i) => i.sku);
    const variantsBySkuRows = await conn
      .select()
      .from(productVariants)
      .where(inArray(productVariants.sku, skus));
    const bySku = new Map(variantsBySkuRows.map((v) => [v.sku, v]));
    const unresolvedSkus = skus.filter((s) => !bySku.has(s));
    if (unresolvedSkus.length > 0) {
      const productRows = await conn
        .select()
        .from(products)
        .where(inArray(products.slug, unresolvedSkus));
      if (productRows.length > 0) {
        const fallbackVariants = await conn
          .select()
          .from(productVariants)
          .where(
            inArray(
              productVariants.productId,
              productRows.map((p) => p.id),
            ),
          );
        const variantsByProductId = new Map<string, typeof fallbackVariants>();
        for (const v of fallbackVariants) {
          const list = variantsByProductId.get(v.productId) ?? [];
          list.push(v);
          variantsByProductId.set(v.productId, list);
        }
        for (const p of productRows) {
          const list = variantsByProductId.get(p.id);
          if (!list || list.length === 0) continue;
          const primary = list[0];
          if (primary) bySku.set(p.slug, primary);
        }
      }
    }
    // Repricing COUPON-AWARE (server-authoritative). On résout le prix via le
    // moteur de coupons avec le MÊME contexte que l'affichage → bucket
    // déterministe → prix facturé == prix affiché (anti PriceMismatchError).
    // Sans coupon, le moteur retombe sur computePromo(price, promoPriceCents)
    // (équivalent au legacy `promoPriceCents ?? priceCents`).
    const { resolveProductPricing } = await import('@/lib/coupons/engine');
    const couponCtx = input.couponContext ?? {};
    let computedTotal = 0;
    let couponRef: import('@/lib/coupons/types').ResolvedCouponRef | null = null;
    let couponSavingsCents = 0;
    const variantMatches: Array<{
      variantId: string;
      sku: string;
      quantity: number;
      unitPriceCents: number;
      name: string;
    }> = [];
    for (const it of input.items) {
      const v = bySku.get(it.sku);
      if (!v) throw new UnknownSkuError(it.sku);
      const resolved = await resolveProductPricing(
        {
          priceCents: v.priceCents,
          promoPriceCents: v.promoPriceCents,
          sku: v.sku,
          currency: v.currency,
        },
        couponCtx,
      );
      const effectivePrice = resolved.effectivePriceCents;
      // Capte le coupon résolu (treatment uniquement = remise effectivement
      // appliquée) pour la journalisation d'incrémentalité.
      if (resolved.coupon && resolved.coupon.bucket === 'treatment') {
        couponRef = resolved.coupon;
        couponSavingsCents += resolved.savingsCents * it.quantity;
      } else if (resolved.coupon && !couponRef) {
        couponRef = resolved.coupon; // holdout : tracé sans savings
      }
      computedTotal += effectivePrice * it.quantity;
      variantMatches.push({
        variantId: v.id,
        sku: it.sku,
        quantity: it.quantity,
        unitPriceCents: effectivePrice,
        name: it.name || v.label,
      });
    }

    // Crédit de fidélité (Phase 3) — réduction additionnelle plafonnée sur le
    // total, cumulable avec le geste d'accueil. Validé (non consommé) ici ; il
    // sera marqué `redeemed` APRÈS la création de la commande.
    let creditGrantCode: string | null = null;
    let creditAppliedCents = 0;
    if (input.couponCode) {
      const { validateGrant } = await import('@/lib/db/queries/coupon-grant-repo');
      const check = await validateGrant(input.couponCode);
      if (check.valid) {
        creditAppliedCents = Math.min(check.valueCents, computedTotal);
        computedTotal -= creditAppliedCents;
        creditGrantCode = check.grant.code;
      }
    }

    if (computedTotal !== input.expectedTotalCents) {
      throw new PriceMismatchError(input.expectedTotalCents, computedTotal);
    }

    // 2. Réserve le stock pour chaque variant (CAS). Rollback partiel
    //    si l'un échoue.
    const reservations: StockSnapshot[] = [];
    try {
      for (const v of variantMatches) {
        const snap = await stockRepo.reserve(v.variantId, v.quantity);
        if (!snap) {
          throw new StockInsufficientError(v.variantId, v.sku, v.quantity);
        }
        reservations.push(snap);
      }
    } catch (err) {
      // Libère les réservations déjà prises avant de propager.
      for (let i = 0; i < reservations.length; i += 1) {
        const v = variantMatches[i];
        if (!v) continue;
        await stockRepo.release(v.variantId, v.quantity);
      }
      throw err;
    }

    // 3-4. Lead legacy + insert order/items. Si quoi que ce soit échoue APRÈS
    //      la réserve, on LIBÈRE les réservations pour ne pas fuiter du stock.
    const orderId = createId('o');
    try {
      const legacyLeadId = await resolveLegacyLeadId(input.contact);
      await conn.insert(orders).values({
        id: orderId,
        leadId: legacyLeadId,
        chatLeadId: input.chatLeadId,
        totalCents: input.expectedTotalCents,
        currency: input.currency,
        shippingMode: input.shippingMode,
        paymentMethod: input.paymentMethod,
        formId: input.formContext.formId,
        formMode: input.formContext.formMode,
        variantKey: input.formContext.variantKey ?? null,
      });

      const itemInserts = variantMatches.map((v) => ({
        id: createId('oi'),
        orderId,
        sku: v.sku,
        name: v.name,
        quantity: v.quantity,
        unitPriceCents: v.unitPriceCents,
      }));
      await conn.insert(orderItems).values(itemInserts);
    } catch (err) {
      for (const v of variantMatches) {
        await stockRepo.release(v.variantId, v.quantity);
      }
      throw err;
    }

    // 5. COMMIT du stock : la commande est posée (COD, état terminal — pas de
    //    flux de livraison qui résoudrait la réservation). On consomme donc la
    //    réservation : `available -= qty`, `reserved -= qty`. SANS ce commit,
    //    `reserved` fuit à chaque commande jusqu'à atteindre `available` →
    //    faux `out_of_stock` PERMANENT (bug 2026-06-01 : reserved bloqué à 100).
    for (const v of variantMatches) {
      await stockRepo.commit(v.variantId, v.quantity);
    }

    // Journalisation incrémentalité — `converted`. Fire-and-forget : un échec
    // ici ne doit JAMAIS faire échouer une commande déjà posée. Idempotent par
    // orderId (index partiel + ON CONFLICT DO NOTHING). createOrder ne
    // s'exécute qu'une fois par commande (l'idempotence amont court-circuite
    // les rejeux), donc pas de double comptage.
    if (couponRef) {
      try {
        const { recordCouponEvent } = await import('@/lib/db/queries/coupon-event-repo');
        await recordCouponEvent({
          couponId: couponRef.id,
          phase: 'converted',
          bucket: couponRef.bucket,
          orderId,
          amountCents: couponSavingsCents,
          visitorKey: couponCtx.visitorKey ?? null,
          trafficSource: couponCtx.trafficSource ?? null,
          device: couponCtx.device ?? null,
        });
      } catch {
        /* non bloquant */
      }
    }

    // Phase 3 — consomme le crédit de fidélité utilisé sur cette commande.
    // Best-effort : le prix a déjà été validé ; un échec de marquage ne doit
    // pas annuler la commande (au pire le crédit reste « issued », corrigible).
    if (creditGrantCode) {
      try {
        const { redeemGrant } = await import('@/lib/db/queries/coupon-grant-repo');
        await redeemGrant(creditGrantCode, orderId);
      } catch {
        /* non bloquant */
      }
    }

    const orderRows = await conn
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    const itemRows = await conn
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    return { ...orderRows[0]!, items: itemRows };
  },
};
