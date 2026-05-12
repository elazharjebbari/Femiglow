import { listWebhookEndpoints } from '@/lib/db/queries/webhook-endpoints';
import { enqueueDelivery } from '@/lib/webhooks/engine';
import { createId } from '@/lib/ids';
import type { WebhookEventName, RitualTestimonial } from '@/lib/db/types';

/**
 * Dispatch d'événements rituel vers tous les endpoints webhook abonnés.
 *
 * Réutilise le moteur générique `enqueueDelivery` : la signature HMAC SHA-256,
 * le retry exponentiel et la persistance `webhook_deliveries` sont gérés là.
 *
 * Cf. docs/reviews-wall/execution/19-plan-action-ameliorations.md § P3.1
 */

export type RitualWebhookEvent = Extract<WebhookEventName, `ritual.${string}`>;

export interface RitualWebhookPayload {
  publicSlug: string;
  productKey: string;
  authorFirstName: string | null;
  authorCity: string | null;
  signal: RitualTestimonial['wouldRecommend'];
  publishedAt: string | null;
  featured: boolean;
  /** Optionnel : raison du rejet ou note de masquage. */
  note?: string;
  /** Optionnel : hash de l'auteur (pour rapprochement CRM). */
  customerHash?: string | null;
}

export interface DispatchResult {
  dispatched: number;
  skipped: number;
  failed: number;
}

export async function dispatchRitualEvent(
  event: RitualWebhookEvent,
  ritual: RitualTestimonial,
  extra: Partial<Pick<RitualWebhookPayload, 'note'>> = {},
): Promise<DispatchResult> {
  const payload: RitualWebhookPayload = {
    publicSlug: ritual.publicSlug,
    productKey: ritual.productKey,
    authorFirstName: ritual.authorFirstName,
    authorCity: ritual.authorCity,
    signal: ritual.wouldRecommend,
    publishedAt: ritual.publishedAt ? ritual.publishedAt.toISOString() : null,
    featured: ritual.featured,
    customerHash: ritual.customerHash,
  };
  if (extra.note) payload.note = extra.note;

  const endpoints = await listWebhookEndpoints();
  const subscribed = endpoints.filter(
    (e) => e.active && !e.deletedAt && (e.events as string[]).includes(event),
  );

  let dispatched = 0;
  let failed = 0;
  const skipped = endpoints.length - subscribed.length;

  for (const endpoint of subscribed) {
    try {
      await enqueueDelivery({
        endpointId: endpoint.id,
        event,
        payload: payload as unknown as Record<string, unknown>,
        idempotencyKey: `${event}:${ritual.id}:${createId('idk')}`,
      });
      dispatched += 1;
    } catch (e) {
      failed += 1;
      console.error('[rituals/webhook-dispatcher] enqueue failed', {
        endpoint: endpoint.id,
        event,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { dispatched, skipped, failed };
}
