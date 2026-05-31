import { TrackingPlanService } from './service';
import { getMemoryStore } from './store-memory';
import { TrackingPlanRepository } from './repository';
import { db } from '@/lib/db/client';
import type { PlanStore } from './store-memory';

export * from './types';
export { validatePlan } from './validator';
export { exportPlan } from './exporter';
export { diffPlans } from './differ';
export { PlanCache } from './cache';
export { TrackingPlanService, ValidationFailedError } from './service';
export { VersionConflictError, TrackingPlanRepository } from './repository';
export { MemoryPlanStore, getMemoryStore } from './store-memory';
export type { PlanStore } from './store-memory';
export { buildCanonicalSeed, canonicalEventKeys } from './canonical-seed';
export type { CanonicalSeedOptions } from './canonical-seed';

let globalService: TrackingPlanService | null = null;

/**
 * Sélection du store selon `TRACKING_PLAN_STORE` :
 *   - `memory` : force le MemoryPlanStore (utile pour tests / dev offline).
 *   - `db`     : force la DB ; lève si `DATABASE_URL` absent.
 *   - `auto` (défaut) : DB si `DATABASE_URL` présent, sinon Memory.
 */
function selectStore(): PlanStore {
  const mode = process.env.TRACKING_PLAN_STORE ?? 'auto';
  if (mode === 'memory') return getMemoryStore();
  const drizzle = db();
  if (mode === 'db') {
    if (!drizzle) throw new Error('TRACKING_PLAN_STORE=db mais DATABASE_URL absent.');
    return new TrackingPlanRepository({ db: drizzle });
  }
  return drizzle ? new TrackingPlanRepository({ db: drizzle }) : getMemoryStore();
}

export function getTrackingPlanService(): TrackingPlanService {
  if (!globalService) {
    globalService = new TrackingPlanService({ store: selectStore() });
  }
  return globalService;
}

export function __resetTrackingPlanServiceForTests(): void {
  globalService = null;
}
