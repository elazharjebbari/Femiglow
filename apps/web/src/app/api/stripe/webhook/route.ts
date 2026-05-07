/**
 * POST /api/stripe/webhook — Stripe webhook handler.
 * cf. docs/analytics/05-onglets-specs.md §5.7
 *
 * Cas d'usage M6 : si Stripe émet `payment_intent.succeeded` (ou
 * `checkout.session.completed`) mais qu'aucun `purchase` event client n'a
 * été tracké pour la session de checkout (user a fermé l'onglet, déconnexion
 * réseau, redirect Stripe foiré), on émet un `purchase_server` côté serveur
 * pour ne pas perdre le KPI conversion. La fenêtre de lookback est 60 min.
 *
 * Sécurité : signature `Stripe-Signature` vérifiée avec `STRIPE_WEBHOOK_SECRET`
 * (HMAC SHA256, tolérance 5 min). Idempotent par `event_id` = ID Stripe.
 */
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { hasRecentPurchase, serverEmit } from '@/lib/tracking/server/server-emit';
import { verifyStripeSignature } from '@/lib/tracking/server/stripe-webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: {
    object: Record<string, unknown> & {
      id: string;
      amount?: number;
      amount_total?: number;
      amount_received?: number;
      currency?: string;
      metadata?: Record<string, string | undefined>;
    };
  };
}

const RELEVANT_TYPES = new Set([
  'payment_intent.succeeded',
  'checkout.session.completed',
]);

export async function POST(request: Request): Promise<Response> {
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    logger.error('stripe.webhook.secret_missing');
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  try {
    verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn('stripe.webhook.signature_invalid', {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'signature_invalid' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!RELEVANT_TYPES.has(event.type)) {
    // Pas notre métier — ack 200 pour ne pas faire boucler Stripe.
    return NextResponse.json({ ignored: event.type });
  }

  const obj = event.data.object;
  const metadata = obj.metadata ?? {};
  // Conventions de tracking côté client : on attache `anonymous_id` et
  // `session_id` dans `metadata` au moment de créer la session checkout.
  const anonymousId = metadata.anonymous_id ?? metadata.anonymousId ?? null;
  const sessionId = metadata.session_id ?? metadata.sessionId ?? null;

  if (!anonymousId || !sessionId) {
    // Sans corrélation client, le fallback ne servirait à rien (impossible
    // de l'attribuer à une session). On log mais on ack pour ne pas spammer.
    logger.warn('stripe.webhook.missing_correlation', {
      stripeEventId: event.id,
      stripeEventType: event.type,
    });
    return NextResponse.json({ ack: true, note: 'no_correlation' });
  }

  // Si un purchase client OU server existe déjà pour cette session, no-op.
  const already = await hasRecentPurchase(sessionId);
  if (already) {
    return NextResponse.json({ ack: true, note: 'already_tracked' });
  }

  const valueCents =
    typeof obj.amount_received === 'number'
      ? obj.amount_received
      : typeof obj.amount_total === 'number'
        ? obj.amount_total
        : typeof obj.amount === 'number'
          ? obj.amount
          : 0;
  const currency =
    typeof obj.currency === 'string' ? obj.currency.toUpperCase() : 'EUR';

  await serverEmit({
    eventName: 'purchase_server',
    eventId: `stripe_${event.id}`,
    pageRoute: '/api/stripe/webhook',
    anonymousId,
    sessionId,
    payload: {
      value: valueCents,
      currency,
      payment_intent_id: obj.id,
      stripe_event_type: event.type,
    },
    receivedAt: new Date(event.created * 1000),
  });

  logger.info('stripe.webhook.purchase_server_emitted', {
    sessionId,
    valueCents,
    stripeEventId: event.id,
  });

  return NextResponse.json({ ack: true, emitted: 'purchase_server' });
}
