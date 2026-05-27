/**
 * CHA-001 — Feature flag pour le système de chat assistant.
 *
 * Deux niveaux :
 *  - `isChatEnabled()` (sync) — kill switch côté env (`CHAT_ENABLED`).
 *    Utilisé par les checks qui ne peuvent pas attendre une DB.
 *  - `isChatActive()` (async, voir `runtime-setting.ts`) — env + toggle
 *    DB pilotable depuis `/admin/chat`. Si l'env est `false`,
 *    `isChatActive()` reste forcément `false`.
 *
 * cf. docs/chat-assistant/15-plan-action.md §2 (Phase 0)
 */
import { env } from '@/lib/env';

export function isChatEnabled(): boolean {
  return env.CHAT_ENABLED === 'true';
}

/**
 * CHA-LEAD-V2 — Active les filtres admin V2 :
 *  - `adminQueries.listConversations` filtre `kind='chat'` + `withMessagesOnly`
 *  - `adminQueries.listChatLeads` filtre `source IN ('chat_widget', 'inline')`
 *
 * Par défaut `false` pour rollback-safe. Toggle à `true` progressivement
 * (staging puis prod) après vérification.
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/00-context/decisions-architecturales.md ADR-002.
 */
export function isChatAdminFiltersV2Enabled(): boolean {
  return env.CHAT_ADMIN_FILTERS_V2 === 'true';
}

/**
 * Garde server-side : à utiliser au début des handlers et des
 * Server Components dépendants. Throw → renvoi en 404 par Next.
 */
export function assertChatEnabled(): void {
  if (!isChatEnabled()) {
    throw new ChatDisabledError();
  }
}

export class ChatDisabledError extends Error {
  constructor() {
    super('chat-disabled');
    this.name = 'ChatDisabledError';
  }
}
