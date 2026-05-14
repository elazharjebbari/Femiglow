/**
 * Zod schemas for Listmonk webhook payloads.
 * Listmonk webhooks have the shape :
 *   { event: '<event>', source: 'listmonk', ts: <unix>, data: {...} }
 *
 * The exact fields per event are best discovered from a real capture
 * (Settings → Webhooks → Test in Listmonk admin) — we accept any extra
 * fields via .passthrough() and only validate the discriminator.
 */
import { z } from 'zod';

const knownEventSchema = z.discriminatedUnion('event', [
  z
    .object({
      event: z.literal('subscriber.created'),
      data: z.record(z.unknown()),
    })
    .passthrough(),
  z
    .object({
      event: z.literal('subscriber.updated'),
      data: z.record(z.unknown()),
    })
    .passthrough(),
  z
    .object({
      event: z.literal('subscriber.unsubscribed'),
      data: z.record(z.unknown()),
    })
    .passthrough(),
  z
    .object({
      event: z.literal('subscriber.bounced'),
      data: z.record(z.unknown()),
    })
    .passthrough(),
  z
    .object({
      event: z.literal('subscriber.complained'),
      data: z.record(z.unknown()),
    })
    .passthrough(),
  z
    .object({
      event: z.literal('campaign.started'),
      data: z.record(z.unknown()),
    })
    .passthrough(),
  z
    .object({
      event: z.literal('campaign.completed'),
      data: z.record(z.unknown()),
    })
    .passthrough(),
]);

const unknownEventSchema = z.object({ event: z.string() }).passthrough();

export const listmonkWebhookSchema = z.union([knownEventSchema, unknownEventSchema]);

export type ListmonkKnownEvent = z.infer<typeof knownEventSchema>;
export type ListmonkWebhookEvent = z.infer<typeof listmonkWebhookSchema>;

const KNOWN_EVENTS = [
  'subscriber.created',
  'subscriber.updated',
  'subscriber.unsubscribed',
  'subscriber.bounced',
  'subscriber.complained',
  'campaign.started',
  'campaign.completed',
] as const;

export function isKnownListmonkEvent(evt: ListmonkWebhookEvent): evt is ListmonkKnownEvent {
  return (KNOWN_EVENTS as readonly string[]).includes(evt.event);
}
