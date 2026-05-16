/**
 * Dispatch unifié : admin endpoints en priorité, fallback outbound URL.
 *
 * Extrait la logique de dispatch dual de `from-wizard-step2.ts` pour la
 * partager entre toutes les sources webhook. Chaque source peut désormais
 * atteindre les endpoints admin configures via l'interface ET l'URL
 * outbound (env var), sans duplication de code.
 */
import { listWebhookEndpoints } from '@/lib/db/queries/webhook-endpoints';
import type { OutboundSource, WebhookDelivery, WebhookEventName } from '@/lib/db/types';
import { logger } from '@/lib/logging/logger';
import { attemptDelivery, enqueueDelivery } from '@/lib/webhooks/engine';

import { dispatchOutbound, resolveWebhookEndpoint, type DispatchResult } from './dispatcher';
import type { OutboundPayload } from './payload';

export interface DispatchToAllChannelsInput {
  /** Source logique pour le log outbound (ex. 'chat-lead'). */
  source: OutboundSource;
  /** ID FemiGlow de l'entité source. */
  sourceId: string;
  /** Clé d'idempotence unique par événement. */
  idempotencyKey: string;
  /** Nom métier de l'événement (ex. 'chat_lead.created'). */
  eventName: WebhookEventName;
  /** Payload validé par Zod. */
  payload: OutboundPayload;
  /** Noms d'événements à matcher côté endpoints admin (fallback : eventName). */
  adminEventNames?: WebhookEventName[];
}

export interface DispatchToAllChannelsResult {
  status: DispatchResult['status'];
  attempts: number;
  responseStatus?: number;
  logId?: string;
  lastError?: string;
  sentPayload?: OutboundPayload;
  /** Nombre d'endpoints admin contactés (même si échoués). */
  adminEndpointsAttempted: number;
}

function resultFromAdminDeliveries(
  results: WebhookDelivery[],
  payload: OutboundPayload,
): DispatchToAllChannelsResult {
  const succeeded = results.find((d) => d.status === 'succeeded');
  if (succeeded) {
    return {
      status: 'sent',
      attempts: succeeded.attemptCount,
      responseStatus: succeeded.responseStatus ?? undefined,
      logId: succeeded.id,
      sentPayload: payload,
      adminEndpointsAttempted: results.length,
    };
  }

  const retryable = results.find((d) => d.status === 'pending');
  if (retryable) {
    return {
      status: 'pending',
      attempts: retryable.attemptCount,
      responseStatus: retryable.responseStatus ?? undefined,
      logId: retryable.id,
      lastError: retryable.errorCode ?? retryable.responseBody ?? 'delivery-pending-retry',
      sentPayload: payload,
      adminEndpointsAttempted: results.length,
    };
  }

  const failed = results.find((d) => d.status === 'failed' || d.status === 'permanent');
  return {
    status: failed ? 'failed' : 'disabled',
    attempts: failed?.attemptCount ?? 0,
    responseStatus: failed?.responseStatus ?? undefined,
    logId: failed?.id,
    lastError: failed?.errorCode ?? failed?.responseBody ?? 'admin-endpoint-delivery-failed',
    sentPayload: payload,
    adminEndpointsAttempted: results.length,
  };
}

async function dispatchToAdminEndpoints(
  input: DispatchToAllChannelsInput,
): Promise<DispatchToAllChannelsResult | null> {
  const endpoints = await listWebhookEndpoints();
  const eventNames = input.adminEventNames ?? [input.eventName];
  const matching = endpoints
    .filter((ep) => ep.active)
    .map((ep) => ({
      endpoint: ep,
      event: eventNames.find((e) => ep.events.includes(e)) ?? null,
    }))
    .filter(
      (entry): entry is { endpoint: (typeof endpoints)[number]; event: WebhookEventName } =>
        entry.event !== null,
    );

  if (matching.length === 0) return null;

  const attempted: WebhookDelivery[] = [];
  for (const { endpoint, event } of matching) {
    try {
      const delivery = await enqueueDelivery({
        endpointId: endpoint.id,
        event,
        idempotencyKey: `${event}:${input.idempotencyKey}`,
        payload: {
          ...input.payload,
          event_name: input.eventName,
          webhook_source: input.source,
          source_id: input.sourceId,
        },
      });
      attempted.push(await attemptDelivery(delivery));
    } catch (err) {
      logger.warn('outbound.webhook.dispatch_to_all_channels.admin_endpoint_failed', {
        endpointId: endpoint.id,
        source: input.source,
        sourceId: input.sourceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (attempted.length === 0) {
    return {
      status: 'failed',
      attempts: 0,
      lastError: 'admin-endpoint-dispatch-failed',
      sentPayload: input.payload,
      adminEndpointsAttempted: matching.length,
    };
  }

  return resultFromAdminDeliveries(attempted, input.payload);
}

/**
 * Dispatch un webhook vers tous les canaux disponibles :
 *   1. Endpoints admin (webhookEndpoints) — si au moins un matche, on l'utilise.
 *   2. Fallback outbound URL (OUTBOUND_WEBHOOK_URL) — si aucun endpoint admin.
 *   3. Si aucun canal configuré → status='disabled'.
 */
export async function dispatchToAllChannels(
  input: DispatchToAllChannelsInput,
): Promise<DispatchToAllChannelsResult> {
  // 1. Tenter les endpoints admin en premier.
  const adminResult = await dispatchToAdminEndpoints(input);
  if (adminResult) return adminResult;

  // 2. Fallback : outbound URL.
  if (!resolveWebhookEndpoint()) {
    return {
      status: 'disabled',
      attempts: 0,
      lastError: 'no-endpoint-configured',
      sentPayload: input.payload,
      adminEndpointsAttempted: 0,
    };
  }

  const outboundResult = await dispatchOutbound({
    source: input.source,
    sourceId: input.sourceId,
    idempotencyKey: input.idempotencyKey,
    eventName: input.eventName,
    payload: input.payload,
  });

  return {
    status: outboundResult.status,
    attempts: outboundResult.attempts,
    responseStatus: outboundResult.responseStatus,
    logId: outboundResult.logId,
    lastError: outboundResult.lastError,
    sentPayload: outboundResult.sentPayload,
    adminEndpointsAttempted: 0,
  };
}