/**
 * OWBS — Enregistrement des handlers d'effets outbox.
 *
 * À appeler avant tout drain (cron worker). Idempotent. Découplé du processor
 * (qui ne connaît que le registry) → on peut enregistrer/retirer des effets sans
 * toucher au cœur.
 *
 * @see ./handlers.ts
 */
import { registerLeadEffectHandler } from './handlers';
import { orderWebhookHandler } from './handlers/order-webhook';

let registered = false;

export function registerLeadEffectHandlers(): void {
  if (registered) return;
  registerLeadEffectHandler('order_webhook', orderWebhookHandler);
  registered = true;
}
