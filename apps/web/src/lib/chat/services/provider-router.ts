/**
 * CHA-037 — Provider router + circuit breaker.
 *
 * Sélectionne le provider de plus haute priorité actif pour un rôle
 * donné, en évitant ceux dont le breaker est ouvert ou le quota épuisé.
 *
 * Multi-provider fallback (R1 live-systems-fix-2026-05) :
 * Le router itère sur tous les candidates triés par priorité — si le
 * primary (OpenAI) a son breaker OPEN, on passe au suivant (Anthropic).
 * La config DB définit l'ordre via `priority` et `is_active`.
 *
 * Sprint 2 S1 + Sprint 3 R1 — Breaker state externalisé :
 * Quand `LIVE_REDIS_STATE=v2`, on utilise `CircuitBreaker` Redis pour
 * éviter la dérive multi-lambda (chaque instance Vercel a sa propre
 * Map sinon). Fallback memory transparent si Redis down.
 *
 * Référence : docs/live-systems-fix-2026-05/06-system-chat-openai.md
 */
import { logger } from '@/lib/logging/logger';

import { instantiateProvider } from '../providers/factory';
import {
  ProviderError,
  type ChatProvider,
  type ChatProviderConfig as ChatProviderConfigDecoded,
} from '../providers/types';
import { providerRepo } from '../repos/provider';
import type { ChatProviderConfigRow } from '../db/schema';
import { LIVE_REDIS_STATE } from '@/lib/feature-flags/live-systems';
import { CircuitBreaker } from '@/lib/redis/circuit-breaker';

interface BreakerState {
  failures: number;
  openedAt: number | null;
  cooldownMs: number;
}

const breakers = new Map<string, BreakerState>();
const FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 30_000;

function getBreaker(id: string): BreakerState {
  let s = breakers.get(id);
  if (!s) {
    s = { failures: 0, openedAt: null, cooldownMs: DEFAULT_COOLDOWN_MS };
    breakers.set(id, s);
  }
  return s;
}

function getRedisBreaker(id: string): CircuitBreaker {
  return new CircuitBreaker(`chat:provider:${id}`, {
    threshold: FAILURE_THRESHOLD,
    openDurationMs: DEFAULT_COOLDOWN_MS,
  });
}

async function isOpenAsync(id: string): Promise<boolean> {
  if (LIVE_REDIS_STATE === 'v2') {
    const cb = getRedisBreaker(id);
    return !(await cb.isAllowed());
  }
  return isOpenMemory(id);
}

function isOpenMemory(id: string): boolean {
  const s = getBreaker(id);
  if (s.openedAt == null) return false;
  if (Date.now() - s.openedAt > s.cooldownMs) {
    s.openedAt = null;
    s.failures = 0;
    return false;
  }
  return true;
}

export function recordFailure(id: string, retryable = true): void {
  // Toujours en mémoire pour rétrocompat sync (la version Redis est async)
  const s = getBreaker(id);
  s.failures += 1;
  if (s.failures >= FAILURE_THRESHOLD || !retryable) {
    s.openedAt = Date.now();
    logger.warn('chat.provider.breaker_open', {
      providerId: id,
      failures: s.failures,
      cooldownMs: s.cooldownMs,
    });
  }
  // Async fire-and-forget vers Redis (cohérent cross-lambda)
  if (LIVE_REDIS_STATE === 'v2') {
    void getRedisBreaker(id).recordFailure().catch((err) => {
      logger.warn('chat.provider.redis_breaker_failure_failed', {
        providerId: id,
        error: (err as Error).message,
      });
    });
  }
}

export function recordSuccess(id: string): void {
  const s = getBreaker(id);
  s.failures = 0;
  s.openedAt = null;
  if (LIVE_REDIS_STATE === 'v2') {
    void getRedisBreaker(id).recordSuccess().catch((err) => {
      logger.warn('chat.provider.redis_breaker_success_failed', {
        providerId: id,
        error: (err as Error).message,
      });
    });
  }
}

function quotaExceeded(row: ChatProviderConfigRow): boolean {
  if (!row.quotaMonthlyEur) return false;
  const consumed = Number(row.consumedMonthEur ?? 0);
  const quota = Number(row.quotaMonthlyEur);
  return consumed >= quota;
}

export const providerRouter = {
  async choose(role: ChatProviderConfigRow['role']): Promise<{
    config: ChatProviderConfigDecoded;
    adapter: ChatProvider;
    row: ChatProviderConfigRow;
  }> {
    const candidates = await providerRepo.listByRole(role, true);
    for (const row of candidates) {
      // R1 — fallback multi-provider via state breaker.
      // Async pour utiliser Redis si v2 ON, sinon memory.
      if (await isOpenAsync(row.id)) {
        logger.info('chat.provider.skipped_breaker_open', { providerId: row.id });
        continue;
      }
      if (quotaExceeded(row)) {
        logger.info('chat.provider.skipped_quota', { providerId: row.id });
        continue;
      }
      const config = providerRepo.decode(row);
      const adapter = instantiateProvider(config);
      return { config, adapter, row };
    }
    throw new ProviderError(
      'unknown',
      `no provider available for role=${role}`,
      { providerId: 'router', retryable: false },
    );
  },

  /**
   * CHA-230 Phase 2 — Choisit le PROCHAIN provider disponible pour un rôle,
   * en excluant celui qu'on a déjà sélectionné comme primaire. Utilisé par
   * `respond-stream.runnable.ts` pour le fallback automatique.
   *
   * Retourne `null` si aucun autre provider valide n'existe — le runnable
   * appellera alors juste retry-only sur le primaire.
   *
   * Critère "valide" identique à `choose()` : breaker fermé, quota dispo.
   * On NE remet PAS à zéro le breaker — si le secondaire est lui aussi
   * cassé, autant remonter l'erreur tout de suite.
   */
  async chooseFallback(
    role: ChatProviderConfigRow['role'],
    excludeId: string,
  ): Promise<{
    config: ChatProviderConfigDecoded;
    adapter: ChatProvider;
    row: ChatProviderConfigRow;
  } | null> {
    const candidates = await providerRepo.listByRole(role, true);
    for (const row of candidates) {
      if (row.id === excludeId) continue;
      if (await isOpenAsync(row.id)) continue;
      if (quotaExceeded(row)) continue;
      const config = providerRepo.decode(row);
      const adapter = instantiateProvider(config);
      return { config, adapter, row };
    }
    return null;
  },

  recordFailure,
  recordSuccess,
};
