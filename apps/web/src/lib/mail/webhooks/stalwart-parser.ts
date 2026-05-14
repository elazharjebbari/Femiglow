/**
 * Zod schemas for Stalwart webhook payloads (v0.16).
 *
 * Event names are Stalwart's canonical EventType enum (cf.
 *   stalwart-cli describe EventType  →  queue.* / delivery.* / auth.*).
 *
 * The schemas are intentionally permissive (`.passthrough()`) because the
 * exact payload shape isn't fully documented for every event ; we only
 * pin the fields we actively consume. New fields land in `rawJson` for
 * later analysis (cf. email_event.rawJson).
 *
 * Cf. docs/emailing/03-backend-integration.md §4.2.
 */
import { z } from 'zod';

// — Inbound submission accepted (app → Stalwart on 587) ——————————————
export const queueAuthenticatedSchema = z
  .object({
    event: z.literal('queue.authenticated-message-queued'),
    queueId: z.string().optional(),
    messageId: z.string().optional(),
    ts: z.string().optional(),
  })
  .passthrough();

// — Normal inbound (anyone → us on 25) ; we use it less but it's free —
export const queueMessageQueuedSchema = z
  .object({
    event: z.literal('queue.message-queued'),
    queueId: z.string().optional(),
    messageId: z.string().optional(),
    ts: z.string().optional(),
  })
  .passthrough();

// — Outbound delivery success ————————————————————————————————————————
export const deliveryDeliveredSchema = z
  .object({
    event: z.literal('delivery.delivered'),
    queueId: z.string().optional(),
    messageId: z.string().optional(),
    rcpt: z.union([z.string(), z.array(z.string())]).optional(),
    ts: z.string().optional(),
  })
  .passthrough();

// — Outbound delivery permanent failure ————————————————————————————————
export const deliveryFailedSchema = z
  .object({
    event: z.literal('delivery.failed'),
    queueId: z.string().optional(),
    messageId: z.string().optional(),
    rcpt: z.union([z.string(), z.array(z.string())]).optional(),
    errorCode: z.number().int().optional(),
    reason: z.string().optional(),
    ts: z.string().optional(),
  })
  .passthrough();

// — Outbound rescheduled (temp failure, will retry) ————————————————————
export const queueRescheduledSchema = z
  .object({
    event: z.literal('queue.rescheduled'),
    queueId: z.string().optional(),
    messageId: z.string().optional(),
    nextRetry: z.string().optional(),
    ts: z.string().optional(),
  })
  .passthrough();

// — Auth failed (security signal) ———————————————————————————————————
export const authFailedSchema = z
  .object({
    event: z.literal('auth.failed'),
    user: z.string().optional(),
    ip: z.string().optional(),
    ts: z.string().optional(),
  })
  .passthrough();

const knownEventSchema = z.discriminatedUnion('event', [
  queueAuthenticatedSchema,
  queueMessageQueuedSchema,
  deliveryDeliveredSchema,
  deliveryFailedSchema,
  queueRescheduledSchema,
  authFailedSchema,
]);

// Catch-all for any other Stalwart event we don't care about (acme.*, dns.*,
// imap.*, etc.). The webhook captures everything (eventsPolicy=exclude with
// empty set), so the receiver must tolerate them and return 200 silently.
const unknownEventSchema = z
  .object({ event: z.string() })
  .passthrough();

export const stalwartWebhookSchema = z.union([knownEventSchema, unknownEventSchema]);

export type StalwartKnownEvent = z.infer<typeof knownEventSchema>;
export type StalwartWebhookEvent = z.infer<typeof stalwartWebhookSchema>;

export function isKnownEvent(evt: StalwartWebhookEvent): evt is StalwartKnownEvent {
  const known = [
    'queue.message-queued',
    'queue.authenticated-message-queued',
    'delivery.delivered',
    'delivery.failed',
    'queue.rescheduled',
    'auth.failed',
  ];
  return known.includes(evt.event);
}

export function isHardBounce(errorCode: number | undefined): boolean {
  return errorCode != null && errorCode >= 500 && errorCode < 600;
}

/**
 * Map Stalwart event names to our internal email_event.type enum.
 * Returns null for events we don't store as discrete email_event rows
 * (e.g. auth.failed is logged elsewhere).
 */
export function mapStalwartEventToInternal(
  event: string,
): 'queued' | 'delivered' | 'bounced_hard' | 'bounced_soft' | 'retried' | null {
  switch (event) {
    case 'queue.message-queued':
    case 'queue.authenticated-message-queued':
      return 'queued';
    case 'delivery.delivered':
      return 'delivered';
    case 'delivery.failed':
      return 'bounced_hard'; // refined to soft via isHardBounce(errorCode) at the call site
    case 'queue.rescheduled':
      return 'retried';
    default:
      return null;
  }
}
