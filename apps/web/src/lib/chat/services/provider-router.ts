/**
 * CHA-037 — Provider router + circuit breaker (in-memory).
 *
 * Sélectionne le provider de plus haute priorité actif pour un rôle
 * donné, en évitant ceux dont le breaker est ouvert ou le quota épuisé.
 *
 * Le breaker est en mémoire process : sur Vercel scale-out, chaque
 * instance gère ses propres compteurs. Acceptable en V1 (cf. doc 03 §3.3).
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

function isOpen(id: string): boolean {
  const s = getBreaker(id);
  if (s.openedAt == null) return false;
  if (Date.now() - s.openedAt > s.cooldownMs) {
    // half-open : on retente
    s.openedAt = null;
    s.failures = 0;
    return false;
  }
  return true;
}

export function recordFailure(id: string, retryable = true): void {
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
}

export function recordSuccess(id: string): void {
  const s = getBreaker(id);
  s.failures = 0;
  s.openedAt = null;
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
      if (isOpen(row.id)) continue;
      if (quotaExceeded(row)) continue;
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
      if (isOpen(row.id)) continue;
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
