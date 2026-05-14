/**
 * Bridge email webhooks → user_event (M5.2.3).
 *
 * Quand un webhook Stalwart (SMTP) ou Listmonk (broadcast) arrive, on
 * réplique l'event dans `user_event` avec source='email'. Cela permet aux
 * audiences/automations de filtrer sur "user X a ouvert un mail dans les 7j".
 *
 * Mapping :
 *   Stalwart delivery.delivered    → user_event email.delivered
 *   Stalwart delivery.failed (5xx) → user_event email.bounced_hard
 *   Stalwart delivery.failed (4xx) → user_event email.bounced_soft
 *   Listmonk subscriber.created    → user_event newsletter.subscribed
 *   Listmonk subscriber.unsubscribed → user_event email.unsubscribed
 *   Listmonk subscriber.bounced    → user_event email.bounced_hard
 *   Listmonk subscriber.complained → user_event email.complaint
 *
 * Les events orientés *campagne* (campaign.started/.completed) ne sont pas
 * répliqués — ils ne sont pas user-level.
 *
 * Fire-and-forget : ne throw pas, log + return null sur error.
 */
import 'server-only';
import { insertUserEventSafe } from '../insert';

// ── Stalwart ────────────────────────────────────────────────────────────

export type StalwartEventForBridge =
  | { event: 'delivery.delivered'; rcpt: string; messageId?: string; ts?: string }
  | {
      event: 'delivery.failed';
      rcpt: string;
      messageId?: string;
      errorCode?: number;
      reason?: string;
      ts?: string;
    };

/**
 * Convertit + persiste un event Stalwart dans user_event.
 * @returns true si persisté, false sinon (event ignoré ou error).
 */
export async function bridgeStalwartToUserEvent(
  evt: StalwartEventForBridge,
): Promise<boolean> {
  if (!evt.rcpt) return false;
  let eventName: string;
  const properties: Record<string, unknown> = {
    messageId: evt.messageId,
  };

  if (evt.event === 'delivery.delivered') {
    eventName = 'email.delivered';
  } else if (evt.event === 'delivery.failed') {
    const code = evt.errorCode ?? 0;
    eventName = code >= 500 ? 'email.bounced_hard' : 'email.bounced_soft';
    properties.errorCode = code;
    properties.reason = evt.reason;
  } else {
    return false;
  }

  const result = await insertUserEventSafe({
    email: evt.rcpt,
    eventName,
    source: 'email',
    properties,
    ts: evt.ts ? new Date(evt.ts) : undefined,
  });
  return result !== null;
}

// ── Listmonk ────────────────────────────────────────────────────────────

export type ListmonkEventForBridge =
  | { event: 'subscriber.created'; email: string; ts?: string; props?: Record<string, unknown> }
  | { event: 'subscriber.unsubscribed'; email: string; ts?: string }
  | { event: 'subscriber.bounced'; email: string; bounceType?: string; ts?: string }
  | { event: 'subscriber.complained'; email: string; ts?: string };

const LISTMONK_EVENT_MAP: Record<ListmonkEventForBridge['event'], string> = {
  'subscriber.created': 'newsletter.subscribed',
  'subscriber.unsubscribed': 'email.unsubscribed',
  'subscriber.bounced': 'email.bounced_hard',
  'subscriber.complained': 'email.complaint',
};

export async function bridgeListmonkToUserEvent(
  evt: ListmonkEventForBridge,
): Promise<boolean> {
  if (!evt.email) return false;
  const eventName = LISTMONK_EVENT_MAP[evt.event];
  if (!eventName) return false;

  const properties: Record<string, unknown> = {};
  if ('bounceType' in evt && evt.bounceType) properties.bounceType = evt.bounceType;
  if ('props' in evt && evt.props) Object.assign(properties, evt.props);

  const result = await insertUserEventSafe({
    email: evt.email,
    eventName,
    source: 'email',
    properties,
    ts: evt.ts ? new Date(evt.ts) : undefined,
  });
  return result !== null;
}
