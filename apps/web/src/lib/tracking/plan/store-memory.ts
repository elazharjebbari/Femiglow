import type {
  AuditAction,
  AuditEntry,
  PlanStatus,
  TrackingPlan,
  TrackingPlanInput,
} from './types';
import { VersionConflictError } from './repository';

function planId(): string {
  return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function auditId(): string {
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface PlanStore {
  findById(id: string): Promise<TrackingPlan | null>;
  findActive(): Promise<TrackingPlan | null>;
  list(filter?: { status?: PlanStatus; search?: string }): Promise<TrackingPlan[]>;
  create(input: TrackingPlanInput, actor: string): Promise<TrackingPlan>;
  update(
    id: string,
    patch: Partial<TrackingPlanInput>,
    expectedVersion: number,
    actor: string,
  ): Promise<TrackingPlan>;
  activate(id: string, actor: string): Promise<TrackingPlan>;
  archive(id: string, actor: string): Promise<TrackingPlan>;
  delete(id: string, actor: string): Promise<void>;
  restore(id: string, actor: string): Promise<TrackingPlan>;
  listAudit(planId?: string): Promise<AuditEntry[]>;
  listDefaults(): Promise<Record<string, string>>;
  reset(): Promise<void>;
}

export class MemoryPlanStore implements PlanStore {
  private plans = new Map<string, TrackingPlan>();
  private audit: AuditEntry[] = [];
  private defaults: Record<string, string> = {};

  constructor(initial?: {
    plans?: TrackingPlan[];
    audit?: AuditEntry[];
    defaults?: Record<string, string>;
  }) {
    if (initial?.plans) for (const p of initial.plans) this.plans.set(p.id, p);
    if (initial?.audit) this.audit.push(...initial.audit);
    if (initial?.defaults) this.defaults = { ...initial.defaults };
  }

  async findById(id: string): Promise<TrackingPlan | null> {
    return this.plans.get(id) ?? null;
  }

  async findActive(): Promise<TrackingPlan | null> {
    for (const p of this.plans.values()) {
      if (p.status === 'active') return p;
    }
    return null;
  }

  async list(filter: { status?: PlanStatus; search?: string } = {}): Promise<TrackingPlan[]> {
    let result = [...this.plans.values()];
    if (filter.status) result = result.filter((p) => p.status === filter.status);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async create(input: TrackingPlanInput, actor: string): Promise<TrackingPlan> {
    const id = planId();
    const now = new Date();
    const plan: TrackingPlan = {
      id,
      name: input.name,
      status: input.status ?? 'draft',
      version: input.version ?? 1,
      providers: input.providers,
      envProfiles: input.envProfiles,
      events: input.events,
      settings: input.settings ?? {},
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    this.plans.set(id, plan);
    this.appendAudit(id, 'create', actor, {});
    return plan;
  }

  async update(
    id: string,
    patch: Partial<TrackingPlanInput>,
    expectedVersion: number,
    actor: string,
  ): Promise<TrackingPlan> {
    const current = this.plans.get(id);
    if (!current) throw new Error('plan_not_found');
    if (current.version !== expectedVersion) {
      throw new VersionConflictError(current.version, expectedVersion);
    }
    const next: TrackingPlan = {
      ...current,
      ...patch,
      providers: patch.providers ?? current.providers,
      envProfiles: patch.envProfiles ?? current.envProfiles,
      events: patch.events ?? current.events,
      settings: patch.settings ?? current.settings,
      version: current.version + 1,
      updatedAt: new Date(),
    };
    this.plans.set(id, next);
    this.appendAudit(id, 'update', actor, {
      previousVersion: current.version,
      nextVersion: next.version,
    });
    return next;
  }

  async activate(id: string, actor: string): Promise<TrackingPlan> {
    const plan = this.plans.get(id);
    if (!plan) throw new Error('plan_not_found');
    if (plan.status === 'active') throw new Error('plan_already_active');

    const archivedIds: string[] = [];
    for (const p of this.plans.values()) {
      if (p.status === 'active') {
        this.plans.set(p.id, { ...p, status: 'archived', updatedAt: new Date() });
        archivedIds.push(p.id);
        this.appendAudit(p.id, 'archive', actor, { reason: 'replaced_by', newPlanId: id });
      }
    }

    const activated: TrackingPlan = {
      ...plan,
      status: 'active',
      version: plan.version + 1,
      updatedAt: new Date(),
    };
    this.plans.set(id, activated);
    this.appendAudit(id, 'activate', actor, { archivedPriorIds: archivedIds });
    return activated;
  }

  async archive(id: string, actor: string): Promise<TrackingPlan> {
    const plan = this.plans.get(id);
    if (!plan) throw new Error('plan_not_found');
    if (plan.status === 'archived') throw new Error('plan_already_archived');
    const archived: TrackingPlan = { ...plan, status: 'archived', updatedAt: new Date() };
    this.plans.set(id, archived);
    this.appendAudit(id, 'archive', actor, {});
    return archived;
  }

  async delete(id: string, actor: string): Promise<void> {
    const plan = this.plans.get(id);
    if (!plan) throw new Error('plan_not_found');
    if (plan.status === 'active') throw new Error('plan_active_cannot_delete');
    this.appendAudit(id, 'delete', actor, {
      name: plan.name,
      status: plan.status,
      version: plan.version,
    });
    this.plans.delete(id);
  }

  async restore(id: string, actor: string): Promise<TrackingPlan> {
    const plan = this.plans.get(id);
    if (!plan) throw new Error('plan_not_found');
    if (plan.status !== 'archived') throw new Error('plan_not_archived');
    const restored: TrackingPlan = {
      ...plan,
      status: 'draft',
      version: plan.version + 1,
      updatedAt: new Date(),
    };
    this.plans.set(id, restored);
    this.appendAudit(id, 'restore', actor, { previousVersion: plan.version });
    return restored;
  }

  async listAudit(planIdFilter?: string): Promise<AuditEntry[]> {
    const entries = planIdFilter
      ? this.audit.filter((a) => a.planId === planIdFilter)
      : [...this.audit];
    return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listDefaults(): Promise<Record<string, string>> {
    return { ...this.defaults };
  }

  setDefaults(defaults: Record<string, string>): void {
    this.defaults = { ...defaults };
  }

  async reset(): Promise<void> {
    this.plans.clear();
    this.audit.length = 0;
  }

  private appendAudit(
    pid: string,
    action: AuditAction,
    actor: string,
    meta: Record<string, unknown>,
  ): void {
    this.audit.push({
      id: auditId(),
      planId: pid,
      action,
      actorEmail: actor,
      meta,
      createdAt: new Date(),
    });
  }
}

let globalStore: MemoryPlanStore | null = null;
export function getMemoryStore(): MemoryPlanStore {
  if (!globalStore) {
    globalStore = new MemoryPlanStore({
      defaults: {
        ga4MeasurementId: 'G-5VHP17SDZM',
        googleAdsConversionId: 'AW-987654321',
        metaPixelId: '1234567890123456',
        gtmContainerId: 'GTM-M8K7V88D',
      },
    });
  }
  return globalStore;
}
