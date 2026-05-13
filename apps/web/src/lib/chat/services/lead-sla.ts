/**
 * CHAT-066 — Helpers SLA pour les leads chat (console Care).
 *
 * Pourquoi
 * ────────
 * Care veut voir d'un coup d'oeil dans /admin/chat/leads :
 *   1. depuis combien de temps un lead attend (createdAt → now)
 *   2. si un lead "hot" (purchase-intent / explicit-request /
 *      inline-contact) en pending dépasse le SLA cible (4h ouvrées).
 *
 * On garde tout en pure functions pour rester testable sans DOM.
 */
import type { ChatLeadRow } from '../db/schema';

export const HOT_TRIGGERS: ReadonlySet<ChatLeadRow['triggerReason']> = new Set([
  'purchase-intent',
  'explicit-request',
  'inline-contact',
]);

/**
 * SLA Care interne — un lead hot doit être pris en charge en moins de 4h.
 * Au-delà, on flag visuellement la ligne en rouge dans la table.
 *
 * 4h = compromis : couvre la pause déj' + une réunion sans crier au feu,
 * mais reste assez tendu pour un lead avec intention d'achat.
 */
export const HOT_PENDING_SLA_HOURS = 4;

/**
 * Renvoie un libellé court de l'âge d'un lead, optimisé pour une cellule
 * de tableau (3-4 caractères max idéalement). Exemples :
 *   • 5 min   → "5m"
 *   • 90 min  → "1h30"
 *   • 26h    → "1j02"
 *   • 5 jours → "5j"
 */
export function formatLeadAge(createdAt: Date, now: Date): string {
  const deltaMs = Math.max(0, now.getTime() - createdAt.getTime());
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const m = minutes % 60;
    return m === 0 ? `${hours}h` : `${hours}h${String(m).padStart(2, '0')}`;
  }
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h === 0 ? `${days}j` : `${days}j${String(h).padStart(2, '0')}`;
}

/**
 * Vrai si le lead est un hot pending dont l'âge dépasse `slaHours`.
 * Permet d'afficher un highlight rouge "SLA dépassé" inline.
 */
export function isHotPendingOverdue(
  lead: Pick<ChatLeadRow, 'outcome' | 'triggerReason' | 'createdAt'>,
  now: Date,
  slaHours: number = HOT_PENDING_SLA_HOURS,
): boolean {
  if (lead.outcome !== 'pending') return false;
  if (!HOT_TRIGGERS.has(lead.triggerReason)) return false;
  const ageMs = now.getTime() - lead.createdAt.getTime();
  return ageMs >= slaHours * 60 * 60 * 1000;
}
