/**
 * Feature flags — Refonte robustesse systèmes live FemiGlow.
 *
 * Référence : `docs/live-systems-fix-2026-05/05-runbook-rollout.md`.
 *
 * Chaque flag est indépendant pour permettre un rollout granulaire et
 * un rollback sélectif (< 60 sec via Vercel env vars).
 *
 * Convention :
 *  - Strict comparison `=== 'true'` / `=== 'on'` pour éviter les bascules
 *    laxistes (un .env mal édité ne doit pas activer en prod).
 *  - Default toujours v1 / off pour rétrocompatibilité.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 1 — Quick wins P0
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active l'appel `openai.moderations.create()` sur input + output chat.
 * Quand 'off' : seul `charterFilter` heuristique (comportement actuel).
 */
export type ChatModerationMode = 'off' | 'on';

export function resolveChatModeration(
  envValue: string | undefined,
): ChatModerationMode {
  return envValue === 'on' ? 'on' : 'off';
}

export const LIVE_CHAT_MODERATION: ChatModerationMode = resolveChatModeration(
  process.env.LIVE_CHAT_MODERATION,
);

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 2 — Structurel (state externalisé)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Externalise dédup tracking + circuit breakers chat dans Redis Upstash.
 * Quand 'v1' : Map JavaScript locale (cassé multi-lambda Vercel).
 * Quand 'v2' : Redis (cohérent cross-lambda).
 */
export type RedisStateMode = 'v1' | 'v2';

export function resolveRedisState(envValue: string | undefined): RedisStateMode {
  return envValue === 'true' ? 'v2' : 'v1';
}

export const LIVE_REDIS_STATE: RedisStateMode = resolveRedisState(
  process.env.NEXT_PUBLIC_LIVE_REDIS_STATE,
);

/**
 * Active le batching Meta CAPI via buffer Redis + cron flush.
 * Quand 'off' : 1 fetch HTTP par event (coûteux à grand volume).
 * Quand 'on'  : push Redis buffer, flush cron toutes les minutes par
 * batch de 50 events max (limite Meta CAPI).
 */
export type CapiBatchingMode = 'off' | 'on';

export function resolveCapiBatching(
  envValue: string | undefined,
): CapiBatchingMode {
  return envValue === 'on' ? 'on' : 'off';
}

export const LIVE_CAPI_BATCHING: CapiBatchingMode = resolveCapiBatching(
  process.env.LIVE_CAPI_BATCHING,
);

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 3 — Roadmap (fallback + monitoring)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active le fallback Anthropic claude-3-haiku quand OpenAI breaker OPEN.
 * Quand 'off' : crash si OpenAI down (comportement actuel).
 * Quand 'anthropic' : fallback gracieux + circuit breaker.
 */
export type ChatFallbackMode = 'off' | 'anthropic';

export function resolveChatFallback(
  envValue: string | undefined,
): ChatFallbackMode {
  return envValue === 'anthropic' ? 'anthropic' : 'off';
}

export const LIVE_CHAT_FALLBACK: ChatFallbackMode = resolveChatFallback(
  process.env.LIVE_CHAT_FALLBACK,
);
