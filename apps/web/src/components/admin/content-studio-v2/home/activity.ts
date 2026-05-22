/**
 * Phase 6 — Home / Activity feed helpers.
 *
 * Pure functions used by `ActivityFeed.tsx` so that they can be unit-tested
 * without rendering React. They translate raw `AuditEvent` rows into
 * UI-ready rows (icon hint + humanized label + relative time).
 */
import type { AuditEvent } from '@/lib/db/types';

export type ActivityIcon =
  | 'sparkles'
  | 'check'
  | 'x'
  | 'edit'
  | 'send'
  | 'trash'
  | 'calendar'
  | 'shield'
  | 'dot';

export interface ActivityRow {
  id: string;
  icon: ActivityIcon;
  /** Short, human readable label (FR). */
  label: string;
  /** Optional detail line (e.g. resource id). */
  detail: string | null;
  /** Relative time string, e.g. "il y a 3min". */
  relativeTime: string;
  /** ISO timestamp for tooltips. */
  isoTime: string;
}

const ACTION_LABEL: Record<string, { label: string; icon: ActivityIcon }> = {
  // Content studio actions
  'content_studio.draft.created':   { label: 'Brouillon créé',        icon: 'sparkles' },
  'content_studio.draft.approved':  { label: 'Brouillon approuvé',    icon: 'check' },
  'content_studio.draft.rejected':  { label: 'Brouillon rejeté',      icon: 'x' },
  'content_studio.draft.edited':    { label: 'Brouillon modifié',     icon: 'edit' },
  'content_studio.post.published':  { label: 'Post publié',           icon: 'send' },
  'content_studio.post.scheduled':  { label: 'Post programmé',        icon: 'calendar' },
  'content_studio.post.cancelled':  { label: 'Publication annulée',   icon: 'x' },
  'content_studio.brand_review':    { label: 'Revue brand exécutée',  icon: 'shield' },
  // Generic admin actions
  'admin.login':                    { label: 'Connexion admin',       icon: 'check' },
  'admin.delete':                   { label: 'Ressource supprimée',   icon: 'trash' },
};

/**
 * Translate one AuditEvent into a UI row.
 * Falls back to a sensible default for unknown action names.
 */
export function formatActivityRow(event: AuditEvent, now: Date = new Date()): ActivityRow {
  const known = ACTION_LABEL[event.action];
  const label = known?.label ?? humanizeAction(event.action);
  const icon = known?.icon ?? 'dot';
  const detail = event.resourceId
    ? `${event.resourceType ?? 'ressource'} · ${event.resourceId.slice(0, 16)}`
    : null;
  return {
    id: event.id,
    icon,
    label,
    detail,
    relativeTime: formatRelativeTime(event.createdAt, now),
    isoTime: event.createdAt.toISOString(),
  };
}

/**
 * Translate a list of AuditEvent into UI rows, sorted desc by createdAt.
 * Tolerant of unsorted inputs.
 */
export function computeRecentActivity(
  events: AuditEvent[],
  now: Date = new Date(),
): ActivityRow[] {
  return events
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((event) => formatActivityRow(event, now));
}

/**
 * Human-readable relative time in French (no i18n lib to keep the deps lean).
 * - < 60s   → "à l'instant"
 * - < 60min → "il y a Nmin"
 * - < 24h   → "il y a Nh"
 * - < 7j    → "il y a Nj"
 * - sinon    → date courte JJ/MM
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const deltaMs = Math.max(0, now.getTime() - date.getTime());
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function humanizeAction(action: string): string {
  // 'content_studio.draft.created' → 'Content studio · draft · created'
  return action
    .split('.')
    .map((p) => p.replace(/_/g, ' '))
    .join(' · ')
    .replace(/^./, (c) => c.toUpperCase());
}
