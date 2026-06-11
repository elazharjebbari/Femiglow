/**
 * CHA-260 — Builder webhook outbound pour les commandes (`order`).
 *
 * Dispatch désormais vers les endpoints admin EN PRIORITÉ, puis fallback
 * outbound URL si aucun endpoint admin ne matche.
 */
import type { ChatLeadRow } from '@/lib/chat/db/schema';

import { logger } from '@/lib/logging/logger';
import { leadRepo } from '@/lib/chat/repos/lead';
import { dispatchToAllChannels, type DispatchToAllChannelsResult } from '../dispatch-to-all-channels';
import { composeFullName, normalizePhoneForPayload } from '../payload';

export interface OrderWebhookContext {
  order: {
    id: string;
    totalCents: number;
    currency: string;
  };
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    variantKey?: string | null;
  }>;
  /** Lead wizard (chat_lead row) — sert pour les coordonnées + adresse. */
  lead: Pick<
    ChatLeadRow,
    | 'id'
    | 'phoneE164'
    | 'phoneRaw'
    | 'firstName'
    | 'email'
    | 'shippingAddressLine1'
    | 'shippingAddressLine2'
    | 'shippingCity'
    | 'shippingCountry'
    | 'shippingNotes'
    | 'source'
    | 'formId'
  >;
  /** Métadonnée tracking : par ex. mode paiement / livraison. */
  shippingMode?: string;
  paymentMethod?: string;
  /** IP client si disponible. */
  ip?: string | null;
}

const COUNTRY_LABEL: Record<string, string> = {
  MA: 'Maroc',
  FR: 'France',
  BE: 'Belgique',
  CH: 'Suisse',
  DZ: 'Algérie',
  TN: 'Tunisie',
};

function joinUnique(values: Array<string | null | undefined>, sep = ' + '): string | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = (v ?? '').trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.length ? out.join(sep) : undefined;
}

function composeAddress(line1: string | null, line2: string | null): string | undefined {
  const a = (line1 ?? '').trim();
  const b = (line2 ?? '').trim();
  if (!a && !b) return undefined;
  if (!b) return a;
  if (!a) return b;
  return `${a}, ${b}`;
}

export interface BuildOrderPayloadResult {
  status: DispatchToAllChannelsResult['status'];
  attempts: number;
  responseStatus?: number;
  logId?: string;
  lastError?: string;
}

/**
 * Synchronise `chat_lead.webhook_status` depuis le résultat du webhook commande,
 * pour que /admin/leads ne reste pas bloqué sur « En attente » après un achat
 * (les leads wizard ne déclenchent jamais `chat_lead.created`). Best-effort :
 * un échec de marquage NE doit PAS faire échouer/rejouer le webhook (déjà parti).
 * Mappage calqué sur `from-chat-lead`.
 */
async function syncLeadWebhookStatus(
  leadId: string,
  status: DispatchToAllChannelsResult['status'],
  lastError?: string,
): Promise<void> {
  try {
    if (status === 'sent') {
      await leadRepo.markWebhookSent(leadId);
    } else if (status === 'failed' || status === 'skipped') {
      await leadRepo.markWebhookFailed(leadId, lastError ?? status);
    } else if (status === 'disabled') {
      await leadRepo.markWebhookFailed(leadId, 'webhook-not-configured');
    }
  } catch (err) {
    logger.warn('outbound.webhook.order.lead_status_sync_failed', {
      leadId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Construit le payload PLAT et envoie via le dispatcher unifié.
 * Anti-blocage : on n'attend pas la réponse au caller — la route appelle
 * cette fonction sans `await` (fire-and-forget).
 */
export async function dispatchOrderWebhook(
  ctx: OrderWebhookContext,
): Promise<BuildOrderPayloadResult> {
  const phone = normalizePhoneForPayload(ctx.lead.phoneE164 || ctx.lead.phoneRaw, 'MA');
  if (!phone.ok) {
    await syncLeadWebhookStatus(ctx.lead.id, 'skipped', `invalid-phone:${phone.reason}`);
    return {
      status: 'skipped',
      attempts: 0,
      lastError: `invalid-phone:${phone.reason}`,
    };
  }

  const productNames = joinUnique(ctx.items.map((i) => i.name));
  const productSkus = joinUnique(ctx.items.map((i) => i.sku), ', ');
  const productVariant = ctx.items.length === 1 ? ctx.items[0]?.variantKey ?? undefined : undefined;
  const quantity = ctx.items.reduce((acc, it) => acc + (it.quantity ?? 0), 0);
  const totalPrice = Math.round(ctx.order.totalCents) / 100;

  const sourceChannel = ctx.lead.source ?? ctx.lead.formId ?? 'checkout';
  const noteParts: string[] = [];
  if (ctx.lead.shippingNotes) noteParts.push(ctx.lead.shippingNotes.trim());
  if (ctx.shippingMode) noteParts.push(`shipping:${ctx.shippingMode}`);
  if (ctx.paymentMethod) noteParts.push(`payment:${ctx.paymentMethod}`);

  const countryCode = (ctx.lead.shippingCountry ?? 'MA').toUpperCase();
  const countryLabel = COUNTRY_LABEL[countryCode] ?? countryCode;

  const result = await dispatchToAllChannels({
    source: 'order',
    sourceId: ctx.order.id,
    idempotencyKey: `order:${ctx.order.id}`,
    eventName: 'order.created',
    adminEventNames: ['order.created'],
    payload: {
      id: ctx.order.id,
      full_name: composeFullName(ctx.lead.firstName),
      phone: phone.value,
      address: composeAddress(ctx.lead.shippingAddressLine1, ctx.lead.shippingAddressLine2),
      city: ctx.lead.shippingCity ?? undefined,
      country: countryLabel,
      email: ctx.lead.email ?? undefined,
      total_price: totalPrice,
      currency: (ctx.order.currency || 'MAD').toUpperCase(),
      quantity: Math.max(1, quantity),
      product_name: productNames,
      product_variant: productVariant ?? undefined,
      product_sku: productSkus,
      note: noteParts.length ? noteParts.join(' | ') : undefined,
      source_channel: sourceChannel,
      ip: ctx.ip ?? undefined,
    },
  });

  logger.info('outbound.webhook.order.dispatch_result', {
    orderId: ctx.order.id,
    status: result.status,
    attempts: result.attempts,
    responseStatus: result.responseStatus,
    logId: result.logId,
  });

  // Reflète l'état du webhook commande sur le lead (badge /admin/leads).
  await syncLeadWebhookStatus(ctx.lead.id, result.status, result.lastError);

  return {
    status: result.status,
    attempts: result.attempts,
    responseStatus: result.responseStatus,
    logId: result.logId,
    lastError: result.lastError,
  };
}