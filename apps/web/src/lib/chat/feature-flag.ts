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
 * CHA-230 Phase 2 — ajoute deux flags secondaires opt-in pour les
 * features Runnable. Les deux ont des profils de risque indépendants
 * (latence vs. comportement en erreur) → flags séparés.
 *
 * cf. docs/chat-assistant/15-plan-action.md §2 (Phase 0)
 *     docs/chat-assistant/20-langchain-robustness-plan.md §2.1
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

/**
 * CHA-230 Phase 2 — flag opt-in pour la classification d'intent via LLM tool-calling.
 *
 * Quand `false` (défaut), seul le classifieur regex pondéré tourne (cf.
 * `services/intent.ts#classifyIntent`). Quand `true`, le runnable
 * `classify-intent.runnable.ts` est utilisé : raccourci regex (score ≥ 3) +
 * tool-call LLM avec `OutputFixingParser` + fallback regex en dernier
 * recours.
 *
 * Coût quand `true` : ~200-400ms de latence supplémentaire et 1 appel LLM
 * à ~30-80 tokens en moyenne pour les messages ambigus uniquement (les
 * messages clairs court-circuitent via le regex shortcut).
 */
export function isLlmIntentEnabled(): boolean {
  return env.CHAT_LLM_INTENT_ENABLED === 'true';
}

/**
 * CHA-230 Phase 2 — flag opt-in pour le fallback automatique entre providers.
 *
 * Quand `false` (défaut), une erreur retryable (timeout, 5xx, rate-limit) du
 * provider primaire remonte directement à l'orchestrator → bandeau d'erreur.
 * Quand `true`, le runnable `respond-stream.runnable.ts` retry une fois sur
 * le provider primaire puis bascule sur le provider de fallback (Anthropic
 * par défaut quand le primaire est OpenAI, et inversement).
 *
 * Coût quand `true` : potentiellement 2 appels LLM en cas d'erreur du
 * primaire ; 0 appel supplémentaire en happy path.
 */
export function isProviderFallbackEnabled(): boolean {
  return env.CHAT_PROVIDER_FALLBACK_ENABLED === 'true';
}
