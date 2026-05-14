import { and, desc, eq, sql } from 'drizzle-orm';

import {
  trackingDefaults,
  trackingPlanAudit,
  trackingPlans,
  type TrackingPlanRow,
} from '@/lib/db/schema-tracking-plan';
import {
  type AuditAction,
  type AuditEntry,
  type PlanStatus,
  type TrackingPlan,
  type TrackingPlanInput,
} from './types';
import type { PlanStore } from './store-memory';
import type { DrizzleDb } from '@/lib/db/client';

type DB = DrizzleDb;

function rowToPlan(row: TrackingPlanRow): TrackingPlan {
  return {
    id: row.id,
    name: row.name,
    status: row.status as PlanStatus,
    version: row.version,
    providers: row.providers as TrackingPlan['providers'],
    envProfiles: row.envProfiles as TrackingPlan['envProfiles'],
    events: row.events as TrackingPlan['events'],
    settings: row.settings as TrackingPlan['settings'],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function planId(): string {
  return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function auditId(): string {
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface RepositoryDeps {
  db: DB;
}

export class TrackingPlanRepository implements PlanStore {
  constructor(private readonly deps: RepositoryDeps) {}

  async reset(): Promise<void> {
    /* no-op en production. Pour réinitialiser, voir scripts/reset-tracking-plans.ts. */
  }

  async findById(id: string): Promise<TrackingPlan | null> {
    const rows = await this.deps.db
      .select()
      .from(trackingPlans)
      .where(eq(trackingPlans.id, id))
      .limit(1);
    return rows[0] ? rowToPlan(rows[0]) : null;
  }

  async findActive(): Promise<TrackingPlan | null> {
    const rows = await this.deps.db
      .select()
      .from(trackingPlans)
      .where(eq(trackingPlans.status, 'active'))
      .limit(1);
    return rows[0] ? rowToPlan(rows[0]) : null;
  }

  async list(filter: { status?: PlanStatus; search?: string } = {}): Promise<TrackingPlan[]> {
    const conditions = [];
    if (filter.status) conditions.push(eq(trackingPlans.status, filter.status));
    if (filter.search) conditions.push(sql`${trackingPlans.name} ILIKE ${'%' + filter.search + '%'}`);

    const query = this.deps.db
      .select()
      .from(trackingPlans)
      .orderBy(desc(trackingPlans.createdAt));

    const rows =
      conditions.length > 0
        ? await query.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
        : await query;
    return rows.map(rowToPlan);
  }

  async create(input: TrackingPlanInput, actor: string): Promise<TrackingPlan> {
    const id = planId();
    const now = new Date();
    return this.deps.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(trackingPlans)
        .values({
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
        })
        .returning();
      await tx.insert(trackingPlanAudit).values({
        id: auditId(),
        planId: id,
        action: 'create',
        actorEmail: actor,
        meta: {},
        createdAt: now,
      });
      return rowToPlan(row!);
    });
  }

  async update(
    id: string,
    patch: Partial<TrackingPlanInput>,
    expectedVersion: number,
    actor: string,
  ): Promise<TrackingPlan> {
    return this.deps.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(trackingPlans)
        .where(eq(trackingPlans.id, id))
        .limit(1);
      if (!current) throw new Error('plan_not_found');
      if (current.version !== expectedVersion) {
        throw new VersionConflictError(current.version, expectedVersion);
      }

      const next = {
        ...current,
        ...patch,
        version: current.version + 1,
        updatedAt: new Date(),
      };

      const [row] = await tx
        .update(trackingPlans)
        .set({
          name: next.name,
          providers: next.providers,
          envProfiles: next.envProfiles,
          events: next.events,
          settings: next.settings,
          version: next.version,
          updatedAt: next.updatedAt,
        })
        .where(eq(trackingPlans.id, id))
        .returning();
      await tx.insert(trackingPlanAudit).values({
        id: auditId(),
        planId: id,
        action: 'update',
        actorEmail: actor,
        meta: { previousVersion: current.version, nextVersion: next.version },
        createdAt: new Date(),
      });
      return rowToPlan(row!);
    });
  }

  async activate(id: string, actor: string): Promise<TrackingPlan> {
    return this.deps.db.transaction(async (tx) => {
      const [plan] = await tx
        .select()
        .from(trackingPlans)
        .where(eq(trackingPlans.id, id))
        .limit(1);
      if (!plan) throw new Error('plan_not_found');
      if (plan.status === 'active') throw new Error('plan_already_active');

      const previousActive = await tx
        .select()
        .from(trackingPlans)
        .where(eq(trackingPlans.status, 'active'));

      for (const prev of previousActive) {
        await tx
          .update(trackingPlans)
          .set({ status: 'archived', updatedAt: new Date() })
          .where(eq(trackingPlans.id, prev.id));
        await tx.insert(trackingPlanAudit).values({
          id: auditId(),
          planId: prev.id,
          action: 'archive',
          actorEmail: actor,
          meta: { reason: 'replaced_by', newPlanId: id },
          createdAt: new Date(),
        });
      }

      const [activated] = await tx
        .update(trackingPlans)
        .set({ status: 'active', version: plan.version + 1, updatedAt: new Date() })
        .where(eq(trackingPlans.id, id))
        .returning();
      await tx.insert(trackingPlanAudit).values({
        id: auditId(),
        planId: id,
        action: 'activate',
        actorEmail: actor,
        meta: { archivedPriorIds: previousActive.map((p) => p.id) },
        createdAt: new Date(),
      });

      return rowToPlan(activated!);
    });
  }

  async archive(id: string, actor: string): Promise<TrackingPlan> {
    return this.deps.db.transaction(async (tx) => {
      const [plan] = await tx
        .select()
        .from(trackingPlans)
        .where(eq(trackingPlans.id, id))
        .limit(1);
      if (!plan) throw new Error('plan_not_found');
      if (plan.status === 'archived') throw new Error('plan_already_archived');

      const [row] = await tx
        .update(trackingPlans)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(trackingPlans.id, id))
        .returning();
      await tx.insert(trackingPlanAudit).values({
        id: auditId(),
        planId: id,
        action: 'archive',
        actorEmail: actor,
        meta: {},
        createdAt: new Date(),
      });
      return rowToPlan(row!);
    });
  }

  async delete(id: string, actor: string): Promise<void> {
    await this.deps.db.transaction(async (tx) => {
      const [plan] = await tx
        .select()
        .from(trackingPlans)
        .where(eq(trackingPlans.id, id))
        .limit(1);
      if (!plan) throw new Error('plan_not_found');
      if (plan.status === 'active') throw new Error('plan_active_cannot_delete');

      // Audit AVANT delete (triggers PL/pgSQL bloquent UPDATE/DELETE sur audit,
      // pas l'insertion). On garde la trace même après disparition du plan.
      await tx.insert(trackingPlanAudit).values({
        id: auditId(),
        planId: id,
        action: 'delete',
        actorEmail: actor,
        meta: { name: plan.name, status: plan.status, version: plan.version },
        createdAt: new Date(),
      });
      await tx.delete(trackingPlans).where(eq(trackingPlans.id, id));
    });
  }

  async restore(id: string, actor: string): Promise<TrackingPlan> {
    return this.deps.db.transaction(async (tx) => {
      const [plan] = await tx
        .select()
        .from(trackingPlans)
        .where(eq(trackingPlans.id, id))
        .limit(1);
      if (!plan) throw new Error('plan_not_found');
      if (plan.status !== 'archived') throw new Error('plan_not_archived');

      const [row] = await tx
        .update(trackingPlans)
        .set({ status: 'draft', version: plan.version + 1, updatedAt: new Date() })
        .where(eq(trackingPlans.id, id))
        .returning();
      await tx.insert(trackingPlanAudit).values({
        id: auditId(),
        planId: id,
        action: 'restore',
        actorEmail: actor,
        meta: { previousVersion: plan.version },
        createdAt: new Date(),
      });
      return rowToPlan(row!);
    });
  }

  async listAudit(planId?: string): Promise<AuditEntry[]> {
    const query = this.deps.db
      .select()
      .from(trackingPlanAudit)
      .orderBy(desc(trackingPlanAudit.createdAt));
    const rows = planId ? await query.where(eq(trackingPlanAudit.planId, planId)) : await query;
    return rows.map((r) => ({
      id: r.id,
      planId: r.planId,
      action: r.action as AuditAction,
      actorEmail: r.actorEmail,
      meta: r.meta as Record<string, unknown>,
      createdAt: r.createdAt,
    }));
  }

  async listDefaults(): Promise<Record<string, string>> {
    const rows = await this.deps.db.select().from(trackingDefaults);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
}

export class VersionConflictError extends Error {
  constructor(
    public readonly currentVersion: number,
    public readonly attemptedVersion: number,
  ) {
    super(
      `version_conflict (current=${currentVersion}, attempted=${attemptedVersion})`,
    );
    this.name = 'VersionConflictError';
  }
}
