import { asc, eq, isNull, and } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { TrackingComponent, TrackingComponentCategory, TrackingPageComponent } from '@/lib/db/types';

export interface UpsertTrackingComponentInput {
  name: string;
  path: string;
  category: TrackingComponentCategory;
  description?: string | null;
  enabled?: boolean;
  defaultParams?: Record<string, unknown>;
}

export interface UpdateTrackingComponentInput {
  name?: string;
  category?: TrackingComponentCategory;
  description?: string | null;
  enabled?: boolean;
  defaultParams?: Record<string, unknown>;
}

function rowToComponent(row: typeof schema.trackingComponents.$inferSelect): TrackingComponent {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    category: row.category as TrackingComponentCategory,
    description: row.description ?? null,
    enabled: row.enabled,
    defaultParams: (row.defaultParams as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export async function findTrackingComponentById(id: string): Promise<TrackingComponent | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingComponents)
      .where(eq(schema.trackingComponents.id, id))
      .limit(1);
    return rows[0] ? rowToComponent(rows[0]) : null;
  }
  return memoryStore().trackingComponents.get(id) ?? null;
}

export async function findTrackingComponentByPath(path: string): Promise<TrackingComponent | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingComponents)
      .where(eq(schema.trackingComponents.path, path))
      .limit(1);
    return rows[0] ? rowToComponent(rows[0]) : null;
  }
  for (const c of memoryStore().trackingComponents.values()) {
    if (c.path === path) return c;
  }
  return null;
}

export async function listTrackingComponents(opts?: {
  includeDeleted?: boolean;
}): Promise<TrackingComponent[]> {
  const drizzle = db();
  if (drizzle) {
    const where = opts?.includeDeleted ? undefined : isNull(schema.trackingComponents.deletedAt);
    const query = drizzle.select().from(schema.trackingComponents);
    const rows = where
      ? await query.where(where).orderBy(asc(schema.trackingComponents.path))
      : await query.orderBy(asc(schema.trackingComponents.path));
    return rows.map(rowToComponent);
  }
  const all = Array.from(memoryStore().trackingComponents.values());
  const filtered = opts?.includeDeleted ? all : all.filter((c) => c.deletedAt === null);
  return filtered.sort((a, b) => a.path.localeCompare(b.path));
}

export async function upsertTrackingComponent(
  input: UpsertTrackingComponentInput,
): Promise<TrackingComponent> {
  const existing = await findTrackingComponentByPath(input.path);
  if (existing) {
    return updateTrackingComponent(existing.id, {
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      enabled: input.enabled,
      defaultParams: input.defaultParams,
    });
  }
  const now = new Date();
  const component: TrackingComponent = {
    id: createId('tc'),
    name: input.name,
    path: input.path,
    category: input.category,
    description: input.description ?? null,
    enabled: input.enabled ?? false,
    defaultParams: input.defaultParams ?? {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.trackingComponents).values({
      id: component.id,
      name: component.name,
      path: component.path,
      category: component.category,
      description: component.description,
      enabled: component.enabled,
      defaultParams: component.defaultParams,
      createdAt: component.createdAt,
      updatedAt: component.updatedAt,
    });
  } else {
    memoryStore().trackingComponents.set(component.id, component);
  }
  return component;
}

export async function updateTrackingComponent(
  id: string,
  input: UpdateTrackingComponentInput,
): Promise<TrackingComponent> {
  const existing = await findTrackingComponentById(id);
  if (!existing) throw new Error(`tracking component ${id} not found`);
  const updated: TrackingComponent = {
    ...existing,
    name: input.name ?? existing.name,
    category: input.category ?? existing.category,
    description: input.description !== undefined ? input.description : existing.description,
    enabled: input.enabled ?? existing.enabled,
    defaultParams: input.defaultParams ?? existing.defaultParams,
    updatedAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.trackingComponents)
      .set({
        name: updated.name,
        category: updated.category,
        description: updated.description,
        enabled: updated.enabled,
        defaultParams: updated.defaultParams,
        updatedAt: updated.updatedAt,
      })
      .where(eq(schema.trackingComponents.id, id));
  } else {
    memoryStore().trackingComponents.set(id, updated);
  }
  return updated;
}

export async function softDeleteTrackingComponent(id: string): Promise<void> {
  const existing = await findTrackingComponentById(id);
  if (!existing) return;
  const drizzle = db();
  const now = new Date();
  if (drizzle) {
    await drizzle
      .update(schema.trackingComponents)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(schema.trackingComponents.id, id));
  } else {
    memoryStore().trackingComponents.set(id, { ...existing, deletedAt: now, updatedAt: now });
  }
}

export async function attachComponentToPage(input: TrackingPageComponent): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .insert(schema.trackingPagesComponents)
      .values({
        pageId: input.pageId,
        componentId: input.componentId,
        position: input.position,
      })
      .onConflictDoNothing();
  } else {
    const key = `${input.pageId}:${input.componentId}`;
    memoryStore().trackingPagesComponents.set(key, input);
  }
}

export async function detachComponentFromPage(pageId: string, componentId: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .delete(schema.trackingPagesComponents)
      .where(
        and(
          eq(schema.trackingPagesComponents.pageId, pageId),
          eq(schema.trackingPagesComponents.componentId, componentId),
        ),
      );
  } else {
    memoryStore().trackingPagesComponents.delete(`${pageId}:${componentId}`);
  }
}

export async function listComponentsForPage(pageId: string): Promise<TrackingComponent[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select({ component: schema.trackingComponents })
      .from(schema.trackingPagesComponents)
      .innerJoin(
        schema.trackingComponents,
        eq(schema.trackingComponents.id, schema.trackingPagesComponents.componentId),
      )
      .where(eq(schema.trackingPagesComponents.pageId, pageId));
    return rows.map((r) => rowToComponent(r.component));
  }
  const store = memoryStore();
  const out: TrackingComponent[] = [];
  for (const link of store.trackingPagesComponents.values()) {
    if (link.pageId !== pageId) continue;
    const c = store.trackingComponents.get(link.componentId);
    if (c) out.push(c);
  }
  return out;
}
