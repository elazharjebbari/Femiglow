import type { TrackingPlan } from './types';

interface Entry {
  plan: TrackingPlan;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 30_000;

export class PlanCache {
  private active: Entry | null = null;
  private byId = new Map<string, Entry>();

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  getActive(): TrackingPlan | null {
    if (!this.active) return null;
    if (Date.now() > this.active.expiresAt) {
      this.active = null;
      return null;
    }
    return this.active.plan;
  }

  setActive(plan: TrackingPlan | null): void {
    if (!plan) {
      this.active = null;
      return;
    }
    this.active = { plan, expiresAt: Date.now() + this.ttlMs };
    this.byId.set(plan.id, this.active);
  }

  getById(id: string): TrackingPlan | null {
    const entry = this.byId.get(id);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.byId.delete(id);
      return null;
    }
    return entry.plan;
  }

  setById(plan: TrackingPlan): void {
    this.byId.set(plan.id, { plan, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(id?: string): void {
    if (id) {
      this.byId.delete(id);
      if (this.active?.plan.id === id) this.active = null;
    } else {
      this.byId.clear();
      this.active = null;
    }
  }
}

export const globalPlanCache = new PlanCache();
