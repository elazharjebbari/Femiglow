import { diffPlans, type ChangeSet } from './differ';
import { exportPlan } from './exporter';
import { PlanCache, globalPlanCache } from './cache';
import { VersionConflictError } from './repository';
import type { PlanStore } from './store-memory';
import type {
  AuditEntry,
  EnvName,
  ExportResult,
  PlanStatus,
  TrackingPlan,
  TrackingPlanInput,
  ValidationResult,
} from './types';
import { validatePlan } from './validator';

export interface TrackingPlanServiceDeps {
  store: PlanStore;
  cache?: PlanCache;
}

export class TrackingPlanService {
  private readonly cache: PlanCache;

  constructor(private readonly deps: TrackingPlanServiceDeps) {
    this.cache = deps.cache ?? globalPlanCache;
  }

  async list(filter: { status?: PlanStatus; search?: string } = {}): Promise<TrackingPlan[]> {
    return this.deps.store.list(filter);
  }

  async get(id: string): Promise<TrackingPlan | null> {
    const cached = this.cache.getById(id);
    if (cached) return cached;
    const plan = await this.deps.store.findById(id);
    if (plan) this.cache.setById(plan);
    return plan;
  }

  async getActive(): Promise<TrackingPlan | null> {
    const cached = this.cache.getActive();
    if (cached) return cached;
    const plan = await this.deps.store.findActive();
    this.cache.setActive(plan);
    return plan;
  }

  async create(input: TrackingPlanInput, actor: string): Promise<TrackingPlan> {
    const plan = await this.deps.store.create(input, actor);
    this.cache.setById(plan);
    return plan;
  }

  async update(
    id: string,
    patch: Partial<TrackingPlanInput>,
    expectedVersion: number,
    actor: string,
  ): Promise<TrackingPlan> {
    const plan = await this.deps.store.update(id, patch, expectedVersion, actor);
    this.cache.invalidate(id);
    this.cache.setById(plan);
    return plan;
  }

  async validate(id: string): Promise<ValidationResult> {
    const plan = await this.deps.store.findById(id);
    if (!plan) throw new Error('plan_not_found');
    return validatePlan(plan);
  }

  async export(id: string, env: EnvName): Promise<ExportResult> {
    const plan = await this.deps.store.findById(id);
    if (!plan) throw new Error('plan_not_found');
    const result = validatePlan(plan);
    if (!result.ok) {
      throw new ValidationFailedError(result);
    }
    return exportPlan(plan, env);
  }

  async activate(id: string, actor: string): Promise<TrackingPlan> {
    const plan = await this.deps.store.findById(id);
    if (!plan) throw new Error('plan_not_found');
    const result = validatePlan(plan);
    if (!result.ok) {
      throw new ValidationFailedError(result);
    }
    const activated = await this.deps.store.activate(id, actor);
    this.cache.invalidate();
    this.cache.setActive(activated);
    return activated;
  }

  async archive(id: string, actor: string): Promise<TrackingPlan> {
    const archived = await this.deps.store.archive(id, actor);
    this.cache.invalidate(id);
    return archived;
  }

  async delete(id: string, actor: string): Promise<void> {
    await this.deps.store.delete(id, actor);
    this.cache.invalidate(id);
  }

  async restore(id: string, actor: string): Promise<TrackingPlan> {
    const restored = await this.deps.store.restore(id, actor);
    this.cache.invalidate(id);
    this.cache.setById(restored);
    return restored;
  }

  async diff(idA: string, idB: string): Promise<ChangeSet> {
    const [a, b] = await Promise.all([
      this.deps.store.findById(idA),
      this.deps.store.findById(idB),
    ]);
    if (!a || !b) throw new Error('plan_not_found');
    return diffPlans(a, b);
  }

  async history(planId?: string): Promise<AuditEntry[]> {
    return this.deps.store.listAudit(planId);
  }

  async defaults(): Promise<Record<string, string>> {
    return this.deps.store.listDefaults();
  }
}

export class ValidationFailedError extends Error {
  constructor(public readonly result: ValidationResult) {
    super(`validation_failed: ${result.errors.length} error(s)`);
    this.name = 'ValidationFailedError';
  }
}

export { VersionConflictError };
