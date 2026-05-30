/**
 * Circuit Breaker pattern via Redis (state externalisé).
 *
 * Référence : `docs/live-systems-fix-2026-05/06-system-chat-openai.md` § S1
 *
 * États :
 *  - CLOSED   : tout passe (normal)
 *  - OPEN     : tout bloqué (après N failures consécutifs)
 *  - HALF_OPEN: probe (après timeout, on autorise 1 essai)
 *
 * Storage Redis :
 *  - `cb:<name>:failures` (counter, no TTL) — failures consécutifs
 *  - `cb:<name>:opened_at` (timestamp ms, TTL = resetMs / 1000)
 *    présence = breaker OPEN. Expiration auto → HALF_OPEN puis CLOSED.
 *
 * Fail-safe : si Redis down → return CLOSED (allow traffic). Le but du
 * breaker n'est pas de bloquer plus fort qu'un crash Redis, mais de
 * protéger les services externes (OpenAI etc.) quand on a state cohérent.
 */
import 'server-only';
import { redis } from './client';
import { logger } from '@/lib/logging/logger';

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface BreakerOptions {
  /** Seuil de failures consécutifs avant ouverture. Default 5. */
  threshold?: number;
  /** Temps en ms pendant lequel le breaker reste OPEN. Default 30s. */
  openDurationMs?: number;
}

const DEFAULT_THRESHOLD = 5;
const DEFAULT_OPEN_DURATION_MS = 30_000;

export class CircuitBreaker {
  private readonly name: string;
  private readonly threshold: number;
  private readonly openDurationMs: number;

  constructor(name: string, options: BreakerOptions = {}) {
    this.name = name;
    this.threshold = options.threshold ?? DEFAULT_THRESHOLD;
    this.openDurationMs = options.openDurationMs ?? DEFAULT_OPEN_DURATION_MS;
  }

  private failuresKey(): string {
    return `cb:${this.name}:failures`;
  }

  private openedAtKey(): string {
    return `cb:${this.name}:opened_at`;
  }

  /**
   * Retourne l'état courant. Si OPEN expiré (TTL écoulé) → HALF_OPEN.
   * Si pas de marker OPEN → CLOSED.
   */
  async state(): Promise<BreakerState> {
    try {
      const openedAt = await redis.get(this.openedAtKey());
      if (!openedAt) return 'CLOSED';
      const openedTime = parseInt(openedAt, 10);
      if (Number.isNaN(openedTime)) return 'CLOSED';
      const elapsed = Date.now() - openedTime;
      if (elapsed >= this.openDurationMs) {
        return 'HALF_OPEN';
      }
      return 'OPEN';
    } catch (err) {
      logger.warn('circuit_breaker.state.failed_fail_safe', {
        name: this.name,
        error: (err as Error).message,
      });
      // Fail-safe : allow traffic plutôt que tout bloquer si Redis down
      return 'CLOSED';
    }
  }

  /**
   * Helper convenience : true si le breaker autorise traffic.
   * CLOSED ou HALF_OPEN → true. OPEN → false.
   */
  async isAllowed(): Promise<boolean> {
    const s = await this.state();
    return s !== 'OPEN';
  }

  /**
   * Enregistre un succès → reset le compteur + clear opened_at.
   * Force le retour à CLOSED même depuis HALF_OPEN.
   */
  async recordSuccess(): Promise<void> {
    try {
      await Promise.all([
        redis.del(this.failuresKey()),
        redis.del(this.openedAtKey()),
      ]);
    } catch (err) {
      logger.warn('circuit_breaker.record_success.failed', {
        name: this.name,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Enregistre une failure → increment compteur. Si ≥ threshold → ouvre.
   * Si déjà OPEN, le compteur n'est pas reset.
   *
   * TTL du marker `opened_at` = 4× `openDurationMs` pour laisser le temps
   * à HALF_OPEN d'être détecté (sinon, la clé expire AU MOMENT OÙ on
   * passe à HALF_OPEN et on retombe en CLOSED sans probe). 4× est une
   * marge confortable — l'admin peut reset manuellement si besoin.
   */
  async recordFailure(): Promise<BreakerState> {
    try {
      const failures = await redis.incr(this.failuresKey());
      if (failures >= this.threshold) {
        const ttlSec = Math.ceil((this.openDurationMs * 4) / 1000);
        await redis.set(this.openedAtKey(), String(Date.now()), { ex: ttlSec });
        return 'OPEN';
      }
      return 'CLOSED';
    } catch (err) {
      logger.warn('circuit_breaker.record_failure.failed', {
        name: this.name,
        error: (err as Error).message,
      });
      return 'CLOSED'; // fail-safe
    }
  }

  /**
   * Reset manuel — utile pour debug ou bypass admin.
   */
  async reset(): Promise<void> {
    try {
      await Promise.all([
        redis.del(this.failuresKey()),
        redis.del(this.openedAtKey()),
      ]);
    } catch (err) {
      logger.warn('circuit_breaker.reset.failed', {
        name: this.name,
        error: (err as Error).message,
      });
    }
  }
}
