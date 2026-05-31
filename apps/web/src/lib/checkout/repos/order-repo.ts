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
    let computedTotal = 0;
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
      const effectivePrice = v.promoPriceCents ?? v.priceCents;
      computedTotal += effectivePrice * it.quantity;
      variantMatches.push({
        variantId: v.id,
        sku: it.sku,
        quantity: it.quantity,
        unitPriceCents: effectivePrice,
        name: it.name || v.label,
      });
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

    // 3. Crée le legacy `leads` row (FK orders.lead_id).
    const legacyLeadId = await resolveLegacyLeadId(input.contact);

    // 4. Insère l'order et ses items.
    const orderId = createId('o');
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
