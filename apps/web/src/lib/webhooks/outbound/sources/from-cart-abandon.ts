/**
 * CHA-260 — Builder webhook outbound pour les paniers abandonnés.
 *
 * Déclenché par `cart-abandon-scanner.ts` qui passe en revue les
 * `chat_lead` rows éligibles (cf. runbook §2.3 pour les règles).
 *
 * Phone-gate STRICT : on ne tente l'envoi QUE si `phoneE164` est
 * exploitable. La règle d'éligibilité du scanner garantit déjà cela,
 * mais on revérifie en défense.
 *
 * Payload minimal mais riche :
 *  - `full_name` + `phone` (requis)
 *  - `email`, `address`, `city`, `country` (si l'étape adresse a été
 *    franchie côté wizard)
 *  - `total_price`, `currency`, `quantity`, `product_name`, `product_sku`
 *    (si `cart_snapshot` est présent)
 *
 * Idempotency-key : `cart-abandon:<lead.id>` — un seul webhook par
 * lead-abandoned (anti-spam strict).
 */
import type { ChatLeadRow } from '@/lib/chat/db/schema';

import { dispatchOutbound, type DispatchResult } from '../dispatcher';
import { composeFullName, normalizePhoneForPayload } from '../payload';

const COUNTRY_LABEL: Record<string, string> = {
  MA: 'Maroc',
  FR: 'France',
  BE: 'Belgique',
  CH: 'Suisse',
  DZ: 'Algérie',
  TN: 'Tunisie',
};

export interface CartAbandonWebhookResult {
  status: DispatchResult['status'];
  attempts: number;
  responseStatus?: number;
  logId?: string;
  lastError?: string;
}

function composeAddress(line1: string | null, line2: string | null): string | undefined {
  const a = (line1 ?? '').trim();
  const b = (line2 ?? '').trim();
  if (!a && !b) return undefined;
  if (!b) return a;
  if (!a) return b;
  return `${a}, ${b}`;
}

export async function dispatchCartAbandonWebhook(
  lead: ChatLeadRow,
): Promise<CartAbandonWebhookResult> {
  const phone = normalizePhoneForPayload(lead.phoneE164 || lead.phoneRaw, 'MA');
  if (!phone.ok) {
    return {
      status: 'skipped',
      attempts: 0,
      lastError: `invalid-phone:${phone.reason}`,
    };
  }

  const snap = lead.cartSnapshot;
  const items = snap?.items ?? [];
  const productName =
    items.length === 1
      ? items[0]?.name
      : items.length > 1
        ? items.map((i) => i.name).join(' + ')
        : undefined;
  const productSku =
    items.length === 1
      ? items[0]?.sku
      : items.length > 1
        ? items.map((i) => i.sku).join(', ')
        : undefined;
  const quantity = Math.max(1, items.reduce((acc, it) => acc + (it.quantity ?? 0), 0));
  const totalPrice =
    typeof snap?.totalCents === 'number' ? Math.round(snap.totalCents) / 100 : undefined;
  const currency = (snap?.currency ?? lead.cartCurrency ?? 'MAD').toUpperCase();

  const countryCode = (lead.shippingCountry ?? 'MA').toUpperCase();
  const countryLabel = COUNTRY_LABEL[countryCode] ?? countryCode;

  const noteParts: string[] = ['cart-abandoned'];
  if (lead.shippingNotes) noteParts.push(lead.shippingNotes.trim());
  if (lead.lastTouchedStep) noteParts.push(`step:${lead.lastTouchedStep}`);

  const payload = {
    id: `cart-abandon:${lead.id}`,
    full_name: composeFullName(lead.firstName),
    phone: phone.value,
    email: lead.email ?? undefined,
    address: composeAddress(lead.shippingAddressLine1, lead.shippingAddressLine2),
    city: lead.shippingCity ?? undefined,
    country: countryLabel,
    total_price: totalPrice,
    currency,
    quantity,
    product_name: productName,
    product_sku: productSku,
    note: noteParts.join(' | '),
    source_channel: 'cart-abandon',
  };

  const result = await dispatchOutbound({
    source: 'cart-abandon',
    sourceId: lead.id,
    idempotencyKey: `cart-abandon:${lead.id}`,
    eventName: 'cart.abandoned',
    payload,
  });
  return {
    status: result.status,
    attempts: result.attempts,
    responseStatus: result.responseStatus,
    logId: result.logId,
    lastError: result.lastError,
  };
}
