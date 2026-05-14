/**
 * Bridge web tracking → user_event (M5.2.2).
 *
 * Quand /api/track reçoit un event identifiable (= email présent dans le
 * payload OU lié à un user_id qu'on peut résoudre en email), on le réplique
 * dans `user_event` avec source='web'.
 *
 * Les events anonymes (anonymous_id seul, pas d'email) sont ignorés —
 * `user_event` est indexé par email, donc inutile d'y mettre des rows
 * sans identité.
 *
 * Le mapping event_name reste fidèle à ce que GTM envoie (ex `purchase`
 * reste `purchase`, on ne renomme pas en `order.placed` ici). Si on veut
 * renormaliser, on le fera dans une étape ultérieure pour ne pas casser
 * les éventuels consommateurs déjà branchés sur les noms GTM.
 */
import 'server-only';
import { insertUserEventSafe } from '../insert';

/** Shape minimale du payload tracking pertinent pour le bridge. */
export type TrackingEventInput = {
  eventName: string;
  /** L'email — généralement dans `payload.email`, parfois ailleurs. */
  email: string | null | undefined;
  sessionId?: string | null;
  /** Le payload entier de l'event (sera stocké en properties). */
  properties?: Record<string, unknown>;
  /** Override timestamp si l'event vient d'un buffer client (offline). */
  ts?: Date;
};

/**
 * Extrait l'email d'un payload tracking. Cherche dans plusieurs clés
 * possibles (les frameworks tracking ne sont pas tous cohérents) :
 *   - payload.email
 *   - payload.user.email
 *   - payload.lead.email
 */
export function extractEmail(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.email === 'string' && p.email.length > 3) return p.email;
  const user = p.user as Record<string, unknown> | undefined;
  if (user && typeof user.email === 'string' && user.email.length > 3) return user.email;
  const lead = p.lead as Record<string, unknown> | undefined;
  if (lead && typeof lead.email === 'string' && lead.email.length > 3) return lead.email;
  return null;
}

/**
 * Réplique un event tracking dans user_event si l'email est identifiable.
 * Fire-and-forget : ne throw pas, log les erreurs.
 *
 * @returns true si l'event a été persisté en user_event, false sinon.
 */
export async function bridgeWebTrackingToUserEvent(
  input: TrackingEventInput,
): Promise<boolean> {
  const email = input.email ?? extractEmail(input.properties);
  if (!email) return false;

  const result = await insertUserEventSafe({
    email,
    eventName: input.eventName,
    source: 'web',
    sessionId: input.sessionId ?? null,
    properties: input.properties,
    ts: input.ts,
  });

  return result !== null;
}
