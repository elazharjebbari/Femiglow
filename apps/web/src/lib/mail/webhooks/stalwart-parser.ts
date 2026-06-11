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

// — Native Stalwart v0.16 BATCH envelope (R-021) ——————————————————————————
//
// The flat schemas above describe an event as we *consume* it ({ event, … }).
// But the native Stalwart webhook collector actually POSTs a BATCH envelope :
//
//   { "events": [ { id, createdAt, type, data: { … } }, … ] }
//
// (`type` carries the EventType, the per-event payload lives in `data`, and a
// single HTTP request may carry N events). Cf.
//   https://stalw.art/docs/telemetry/webhooks
//   WebhookEvents { events: [ WebhookEvent { id, createdAt, type, data } ] }
//
// Before R-021 the receiver only understood the flat shape, so NOTHING the
// real Stalwart server sent would ever parse — even after the prod infra
// reconfig. `normalizeStalwartPayload` below accepts BOTH shapes and always
// returns a flat-event array, so the rest of the pipeline is unchanged.

const batchEntrySchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    createdAt: z.string().optional(),
    type: z.string(),
    data: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const stalwartBatchEnvelopeSchema = z
  .object({
    events: z.array(batchEntrySchema),
  })
  .passthrough();

export type StalwartBatchEnvelope = z.infer<typeof stalwartBatchEnvelopeSchema>;

/** Type guard : the raw payload is the native `{ events: [...] }` envelope. */
export function isBatchEnvelope(raw: unknown): boolean {
  return (
    !!raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as { events?: unknown }).events) &&
    // A flat event never carries a top-level `event` discriminator AND an
    // `events` array at the same time ; if it somehow did, treat it as flat
    // (the flat path is the legacy contract some tests still rely on).
    !('event' in (raw as Record<string, unknown>))
  );
}

/**
 * Flatten one native batch entry `{ id, createdAt, type, data }` into the flat
 * envelope the rest of the pipeline consumes (`{ event, …data }`).
 *
 *  - `type`        → `event` (the discriminator the flat schemas key on)
 *  - `data.*`      → hoisted to the top level (queueId, messageId, rcpt, …)
 *  - `createdAt`   → `ts` (only if `data` didn't already provide one)
 *  - native `code` → mirrored to `errorCode` when `errorCode` is absent, so
 *                    `isHardBounce()` (which reads `errorCode`) keeps working
 *                    on native payloads that only carry the SMTP `code` field.
 */
export function flattenBatchEntry(entry: StalwartBatchEnvelope['events'][number]): unknown {
  const data = (entry.data ?? {}) as Record<string, unknown>;
  const flat: Record<string, unknown> = { ...data, event: entry.type };
  if (entry.createdAt != null && flat.ts == null) flat.ts = entry.createdAt;
  // Native batch entries carry the SMTP result as `code` ; the failure path of
  // the receiver reads `errorCode`. Mirror it ONLY for delivery.failed so a
  // success `code` (250) never gets misread as an error code.
  if (
    entry.type === 'delivery.failed' &&
    flat.errorCode == null &&
    typeof flat.code === 'number'
  ) {
    flat.errorCode = flat.code;
  }
  return flat;
}

export type StalwartParseResult =
  | { ok: true; events: StalwartWebhookEvent[] }
  | { ok: false; issues: z.ZodIssue[] };

/**
 * Parse a raw Stalwart webhook body into a flat-event ARRAY, accepting BOTH :
 *   - the native batch envelope `{ events: [{ id, createdAt, type, data }] }`
 *     → N flattened events (one per entry) ;
 *   - the legacy flat envelope `{ event, … }`
 *     → exactly one event (retro-compat — existing tests depend on it).
 *
 * Returns `{ ok:false, issues }` if NOTHING parses, so the route can answer a
 * clean 4xx without ever throwing a 500. A batch with a single malformed entry
 * fails the whole batch at the schema level (the malformed entry is surfaced
 * via `issues`) — per-entry *application* errors (DB write, etc.) are isolated
 * downstream by the route, not here.
 */
export function normalizeStalwartPayload(raw: unknown): StalwartParseResult {
  if (isBatchEnvelope(raw)) {
    const env = stalwartBatchEnvelopeSchema.safeParse(raw);
    if (!env.success) return { ok: false, issues: env.error.issues };
    const events: StalwartWebhookEvent[] = [];
    for (const entry of env.data.events) {
      const flat = flattenBatchEntry(entry);
      const parsed = stalwartWebhookSchema.safeParse(flat);
      if (!parsed.success) return { ok: false, issues: parsed.error.issues };
      events.push(parsed.data);
    }
    return { ok: true, events };
  }

  const parsed = stalwartWebhookSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };
  return { ok: true, events: [parsed.data] };
}

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
