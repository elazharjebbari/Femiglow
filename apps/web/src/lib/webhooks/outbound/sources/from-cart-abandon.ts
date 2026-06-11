/**
 * CHA-260 — Builder webhook outbound pour les paniers abandonnés.
 *
 * Déclenché par `cart-abandon-scanner.ts` qui passe en revue les
 * `chat_lead` rows éligibles (cf. runbook §2.3 pour les règles).
 *
 * Dispatch désormais vers les endpoints admin EN PRIORITÉ, puis fallback
 * outbound URL si aucun endpoint admin ne matche.
 */
import type { ChatLeadRow } from '@/lib/chat/db/schema';

import { dispatchToAllChannels, type DispatchToAllChannelsResult } from '../dispatch-to-all-channels';
import { composeFullName, normalizePhoneForPayload } from '../payload';

const COUNTRY_LABEL: Record<string, string> = {
  MA: 'Maroc',
  FR: 'France',
  BE: 'Belgique',
  CH: 'Suisse',
  DZ: 'Algérie',
  TN: 'Tunisie',
};

function composeAddress(line1: string | null, line2: string | null): string | undefined {
  const a = (line1 ?? '').trim();
  const b = (line2 ?? '').trim();
  if (!a && !b) return undefined;
  if (!b) return a;
  if (!a) return b;
  return `${a}, ${b}`;
}

export interface CartAbandonWebhookResult {
  status: DispatchToAllChannelsResult['status'];
  attempts: number;
  responseStatus?: number;
  logId?: string;
  lastError?: string;
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

  const result = await dispatchToAllChannels({
    source: 'cart-abandon',
    sourceId: lead.id,
    idempotencyKey: `cart-abandon:${lead.id}`,
    eventName: 'cart.abandoned',
    adminEventNames: ['cart.abandoned'],
    payload: {
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
      lead_status: 'abandoned' as const,
    },
  });

  return {
    status: result.status,
    attempts: result.attempts,
    responseStatus: result.responseStatus,
    logId: result.logId,
    lastError: result.lastError,
  };
}