/**
 * Server-side emit helper pour les events tracking déclenchés sans navigateur
 * (webhooks, jobs, cron…).
 *
 * Cas d'usage M6 : si Stripe webhook reçoit `payment_intent.succeeded` mais
 * qu'aucun `purchase` client n'a été tracké pour la session correspondante,
 * on émet un `purchase_server` côté serveur pour ne pas perdre le KPI
 * conversion.
 *
 * Différences vs `/api/track` :
 * - Pas de consentement utilisateur à vérifier (event server-side, pas
 *   d'identifiants persistés ni cookies). On force `analytics_storage = granted`
 *   car l'événement vient d'une transaction réelle confirmée par Stripe (donc
 *   le user est en relation contractuelle).
 * - Pas de rate-limit, pas d'enrichissement IP/UA (les events serveur sont
 *   propres par construction).
 */
import { createId } from '@/lib/ids';
import { listEvents, logEvent } from '@/lib/db/queries/tracking/events-log';
import type { TrackingEventLogEntry } from '@/lib/db/types';

export interface ServerEmitInput {
  /** Nom event (ex: 'purchase_server'). */
  eventName: string;
  /** Identifiant unique idempotent (ex: payment_intent.id). */
  eventId: string;
  /** Page d'origine (ex: '/checkout' ou '/api/stripe/webhook'). */
  pageRoute: string;
  /** Anonymous ID dérivé de la session de checkout (cookie `_fg_anon`). */
  anonymousId: string;
  /** Session ID dérivé du checkout client. */
  sessionId: string;
  userId?: string | null;
  /** Payload arbitraire (ex: { value, currency, payment_intent_id }). */
  payload?: Record<string, unknown>;
  /** Locale du checkout (default fr-FR). */
  locale?: string;
  /** Device hint si connu. */
  device?: 'mobile' | 'tablet' | 'desktop';
  /** Force le timestamp. */
  receivedAt?: Date;
}

/**
 * Émet un event tracking côté serveur. Idempotent par `eventId` (l'insert
 * UNIQUE empêche les doublons) — donc on peut le rappeler sans risque.
 */
export async function serverEmit(input: ServerEmitInput): Promise<TrackingEventLogEntry> {
  return logEvent({
    id: createId('evt'),
    eventId: input.eventId,
    eventName: input.eventName,
    eventCategory: 'ecommerce',
    pageRoute: input.pageRoute,
    anonymousId: input.anonymousId,
    sessionId: input.sessionId,
    userId: input.userId ?? null,
    consentSnapshot: {
      ad_storage: 'denied',
      analytics_storage: 'granted',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functional_storage: 'granted',
    },
    payload: input.payload ?? {},
    uaHash: 'server',
    ipAnonymized: '0.0.0.0',
    device: input.device ?? 'desktop',
    locale: input.locale ?? 'fr-FR',
    isConversion: input.eventName === 'purchase_server' || input.eventName === 'purchase',
    providersDispatched: [],
    providersResults: {},
    receivedAt: input.receivedAt ?? new Date(),
    schemaVersion: 1,
  });
}

/**
 * True si la session a déjà émis un `purchase` client OU un `purchase_server`
 * dans la fenêtre de lookback (default 60 min) — utilisé par les webhooks pour
 * éviter les doublons croisés.
 */
export async function hasRecentPurchase(
  sessionId: string,
  now: Date = new Date(),
  lookbackMs: number = 60 * 60_000,
): Promise<boolean> {
  const fromDate = new Date(now.getTime() - lookbackMs);
  // On filtre par session_id ; on accepte n'importe quel event_name dans
  // ['purchase', 'purchase_server'].
  const events = await listEvents({
    sessionId,
    fromDate,
    toDate: now,
    isConversion: true,
    limit: 50,
  });
  for (const e of events) {
    if (e.eventName === 'purchase' || e.eventName === 'purchase_server') {
      return true;
    }
  }
  return false;
}
