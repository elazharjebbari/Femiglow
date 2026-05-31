/**
 * Bridge admin actions → user_event (M5.2.5).
 *
 * Quand un admin modifie le statut d'un lead, ajoute une note, change
 * un attribut, on enregistre dans user_event avec source='admin'. Permet
 * de tracer "ce lead a été qualifié manuellement par l'admin X" et de
 * filtrer en audience.
 */
import 'server-only';
import { insertUserEventSafe } from '../insert';

export type AdminEventInput = {
  /** Email du *target* (le lead modifié). */
  targetEmail: string;
  /** Identifiant de l'admin qui a fait l'action (info contextuelle). */
  actorEmail?: string;
  /** Nom canonique : lead.status_changed, lead.note_added, lead.tag_added… */
  eventName: string;
  properties?: Record<string, unknown>;
  leadId?: string;
};

/**
 * Record un event admin sur un lead. Fire-and-forget.
 */
export async function recordAdminEvent(input: AdminEventInput): Promise<boolean> {
  if (!input.targetEmail || !input.eventName) return false;
  const result = await insertUserEventSafe({
    email: input.targetEmail,
    eventName: input.eventName,
    source: 'admin',
    leadId: input.leadId ?? undefined,
    properties: {
      ...input.properties,
      actorEmail: input.actorEmail,
    },
  });
  return result !== null;
}

export async function recordLeadStatusChanged(input: {
  targetEmail: string;
  actorEmail: string;
  oldStatus: string;
  newStatus: string;
  leadId?: string;
}): Promise<boolean> {
  return recordAdminEvent({
    targetEmail: input.targetEmail,
    actorEmail: input.actorEmail,
    eventName: 'lead.status_changed',
    leadId: input.leadId,
    properties: {
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
    },
  });
}

export async function recordLeadNoteAdded(input: {
  targetEmail: string;
  actorEmail: string;
  noteExcerpt: string;
  leadId?: string;
}): Promise<boolean> {
  return recordAdminEvent({
    targetEmail: input.targetEmail,
    actorEmail: input.actorEmail,
    eventName: 'lead.note_added',
    leadId: input.leadId,
    properties: { noteExcerpt: input.noteExcerpt.slice(0, 200) },
  });
}
