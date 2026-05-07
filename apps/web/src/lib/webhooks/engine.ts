import { getWebhookEndpoint } from '@/lib/db/queries/webhook-endpoints';
import {
  claimPending,
  createDelivery,
  recordDeliveryAttempt,
} from '@/lib/db/queries/webhook-deliveries';
import { decryptSecret } from '@/lib/crypto/encryption';
import { signHmac } from '@/lib/crypto/hmac';
import { logger } from '@/lib/logging/logger';
import { logAuditEvent } from '@/lib/audit/log-event';
import { computeBackoff, MAX_ATTEMPTS } from '@/lib/webhooks/backoff';
import type { WebhookDelivery, WebhookEventName } from '@/lib/db/types';

export const ATTEMPT_TIMEOUT_MS = 10_000;
const RESPONSE_BODY_LIMIT = 4 * 1024;

export async function enqueueDelivery(input: {
  endpointId: string;
  event: WebhookEventName;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<WebhookDelivery> {
  const endpoint = await getWebhookEndpoint(input.endpointId);
  if (!endpoint) throw new Error(`Endpoint ${input.endpointId} introuvable`);
  if (!endpoint.active) {
    logger.info('webhook.enqueue.skipped', { endpoint_id: endpoint.id, reason: 'inactive' });
    throw new Error('Endpoint inactif');
  }
  if (!endpoint.events.includes(input.event)) {
    logger.info('webhook.enqueue.skipped', {
      endpoint_id: endpoint.id,
      reason: 'event_not_subscribed',
    });
    throw new Error('Événement non souscrit');
  }
  const delivery = await createDelivery(input);
  logger.info('webhook.enqueued', {
    delivery_id: delivery.id,
    endpoint_id: endpoint.id,
    event: input.event,
  });
  return delivery;
}

export interface AttemptOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

export async function attemptDelivery(
  delivery: WebhookDelivery,
  options: AttemptOptions = {},
): Promise<WebhookDelivery> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? ATTEMPT_TIMEOUT_MS;

  const endpoint = await getWebhookEndpoint(delivery.endpointId);
  if (!endpoint) {
    return recordDeliveryAttempt({
      id: delivery.id,
      status: 'permanent',
      errorCode: 'endpoint_missing',
    });
  }

  const body = JSON.stringify({
    id: delivery.id,
    event: delivery.event,
    created_at: delivery.createdAt.toISOString(),
    payload: delivery.payload,
  });
  const secret = decryptSecret(endpoint.encryptedSecret);
  const signature = signHmac(secret, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let errorCode: string | null = null;
  try {
    const res = await fetchImpl(endpoint.url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-femiglow-signature': signature,
        'idempotency-key': delivery.idempotencyKey,
        'user-agent': 'FemiGlow-Webhook/1.0',
      },
      body,
    });
    responseStatus = res.status;
    const text = await res.text().catch(() => '');
    responseBody = text.slice(0, RESPONSE_BODY_LIMIT);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      errorCode = 'timeout';
    } else {
      errorCode = 'network_error';
    }
  } finally {
    clearTimeout(timer);
  }
  const latencyMs = Date.now() - startedAt;

  const succeeded = responseStatus !== null && responseStatus >= 200 && responseStatus < 300;
  const newAttemptCount = delivery.attemptCount + 1;
  if (succeeded) {
    return recordDeliveryAttempt({
      id: delivery.id,
      status: 'succeeded',
      responseStatus,
      responseBody,
      latencyMs,
    });
  }

  const reachedMax = newAttemptCount >= MAX_ATTEMPTS;
  if (reachedMax) {
    await logAuditEvent({
      action: 'webhook.delivery.permanent',
      actorId: null,
      resourceType: 'webhook_delivery',
      resourceId: delivery.id,
      meta: { endpoint_id: endpoint.id, response_status: responseStatus, error_code: errorCode },
    });
    return recordDeliveryAttempt({
      id: delivery.id,
      status: 'permanent',
      responseStatus,
      responseBody,
      errorCode,
      latencyMs,
    });
  }

  const nextAttemptAt = new Date(now().getTime() + computeBackoff(newAttemptCount));
  return recordDeliveryAttempt({
    id: delivery.id,
    status: 'pending',
    responseStatus,
    responseBody,
    errorCode,
    latencyMs,
    nextAttemptAt,
  });
}

export async function processBatch(input: {
  limit?: number;
  now?: () => Date;
  fetchImpl?: typeof fetch;
}): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = input.now ?? (() => new Date());
  const claimed = await claimPending(input.limit ?? 50, now());
  let succeeded = 0;
  let failed = 0;
  for (const d of claimed) {
    const result = await attemptDelivery(d, {
      fetchImpl: input.fetchImpl ?? fetch,
      now,
    });
    if (result.status === 'succeeded') succeeded += 1;
    else failed += 1;
  }
  return { processed: claimed.length, succeeded, failed };
}
