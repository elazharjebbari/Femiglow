/**
 * `enrichPurchase` — complète les champs `value` et `currency` d'un event
 * Purchase quand ils sont manquants ou invalides côté params, en faisant
 * une lookup DB sur la table `orders` par `transaction_id`.
 *
 * Fail-closed : si rien de fiable n'est trouvable (params invalides ET
 * order absent), on renvoie `source: 'unavailable'` — l'adapter Meta
 * utilise ce signal pour skipper l'envoi CAPI plutôt que d'envoyer un
 * Purchase corrompu.
 *
 * Module pur (testable en isolation via mock `@/lib/db/client`).
 *
 * cf. docs/meta-quality-audit-2026-05/01-design-conception.md §2.1
 */
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { orders } from '@/lib/db/schema';

export interface PurchaseEnrichInput {
  transaction_id?: unknown;
  value?: unknown;
  currency?: unknown;
}

export interface PurchaseEnrichResult {
  value?: number;
  currency?: string;
  source: 'params' | 'db' | 'unavailable';
}

export function isValidValue(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

export function isValidCurrency(c: unknown): c is string {
  return typeof c === 'string' && /^[A-Z]{3}$/.test(c);
}

export async function enrichPurchase(
  params: PurchaseEnrichInput,
): Promise<PurchaseEnrichResult> {
  if (isValidValue(params.value) && isValidCurrency(params.currency)) {
    return { value: params.value, currency: params.currency, source: 'params' };
  }

  const txId =
    typeof params.transaction_id === 'string' && params.transaction_id.length > 0
      ? params.transaction_id
      : null;
  if (!txId) return { source: 'unavailable' };

  const conn = db();
  if (!conn) return { source: 'unavailable' };

  const rows = await conn
    .select({ totalCents: orders.totalCents, currency: orders.currency })
    .from(orders)
    .where(eq(orders.id, txId))
    .limit(1);

  const order = rows[0];
  if (!order) return { source: 'unavailable' };

  const value = order.totalCents / 100;
  const currency = (order.currency ?? '').toUpperCase();
  if (!isValidValue(value) || !isValidCurrency(currency)) {
    return { source: 'unavailable' };
  }

  return { value, currency, source: 'db' };
}
