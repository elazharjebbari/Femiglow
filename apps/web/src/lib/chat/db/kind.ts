/**
 * CHA-LEAD-V2 — Discriminateur de `chat_session.kind`.
 *
 * Valeurs :
 *  - `'chat'` (default) : conversation chat IA standard, créée par
 *    `sessionRepo.create()` lors du bootstrap widget. ID préfixe `cs_`.
 *  - `'wizard_pivot'` : row pivot insérée par
 *    `wizardSessionRepo.ensureForWizard()` pour satisfaire la FK
 *    `chat_lead.session_id`. Pas de messages. ID préfixe `s_` (généré
 *    client côté wizard).
 *  - `'system'` : row créée par un flow système (newsletter standalone,
 *    admin seed) qui n'a ni interface chat ni wizard.
 *
 * Les queries admin (`adminQueries.listConversations/listChatLeads`)
 * filtrent par défaut `kind='chat'` quand `CHAT_ADMIN_FILTERS_V2=true`.
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/01-design-conception/data-model.md
 */
import type { ChatLeadRow } from './schema';

/** Valeurs possibles de `chat_session.kind`. */
export const CHAT_SESSION_KINDS = ['chat', 'wizard_pivot', 'system'] as const;
export type ChatSessionKind = (typeof CHAT_SESSION_KINDS)[number];

/** Set des kinds visibles dans /admin/chat/conversations. */
export const ADMIN_CHAT_VISIBLE_KINDS: ReadonlyArray<ChatSessionKind> = ['chat'];

/** Set des sources `chat_lead.source` visibles dans /admin/chat/leads. */
export const ADMIN_CHAT_VISIBLE_LEAD_SOURCES: ReadonlyArray<
  ChatLeadRow['source']
> = ['chat_widget', 'inline'];

/** Type guard. */
export function isChatSessionKind(value: unknown): value is ChatSessionKind {
  return (
    typeof value === 'string' &&
    (CHAT_SESSION_KINDS as readonly string[]).includes(value)
  );
}
