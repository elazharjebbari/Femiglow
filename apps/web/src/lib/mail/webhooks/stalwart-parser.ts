/**
 * Zod schemas for Stalwart webhook payloads (v0.16).
 * The shapes are based on official docs ; capture-driven contract tests
 * in __tests__ pin fixtures from real-world traffic.
 *
 * Cf. docs/emailing/03-backend-integration.md §4.2.
 */
import { z } from 'zod';

export const messageQueuedSchema = z.object({
  event: z.literal('message.queued'),
  queueId: z.string(),
  messageId: z.string(),
  rcpt: z.array(z.string()),
  size: z.number().int().nonnegative(),
  ts: z.string(),
});

export const messageDeliveredSchema = z.object({
  event: z.literal('message.delivered'),
  queueId: z.string(),
  messageId: z.string(),
  rcpt: z.string(),
  ts: z.string(),
});

export const messageDeliveryFailedSchema = z.object({
  event: z.literal('message.delivery-failed'),
  queueId: z.string(),
  messageId: z.string(),
  rcpt: z.string(),
  errorCode: z.number().int(),
  reason: z.string(),
  ts: z.string(),
});

export const messageDeliveryDeferredSchema = z.object({
  event: z.literal('message.delivery-deferred'),
  queueId: z.string(),
  messageId: z.string(),
  rcpt: z.string(),
  nextRetry: z.string(),
  ts: z.string(),
});

export const authFailureSchema = z.object({
  event: z.literal('auth.failure'),
  user: z.string(),
  ip: z.string(),
  ts: z.string(),
});

export const stalwartWebhookSchema = z.discriminatedUnion('event', [
  messageQueuedSchema,
  messageDeliveredSchema,
  messageDeliveryFailedSchema,
  messageDeliveryDeferredSchema,
  authFailureSchema,
]);

export type StalwartWebhookEvent = z.infer<typeof stalwartWebhookSchema>;

export function isHardBounce(errorCode: number): boolean {
  return errorCode >= 500 && errorCode < 600;
}
