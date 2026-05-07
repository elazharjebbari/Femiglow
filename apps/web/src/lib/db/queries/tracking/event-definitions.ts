import { asc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type {
  TrackingEventCategory,
  TrackingEventDefinition,
  TrackingEventScope,
  TrackingComponentCategory,
} from '@/lib/db/types';

export interface UpsertTrackingEventDefinitionInput {
  name: string;
  category: TrackingEventCategory;
  scope?: TrackingEventScope;
  description: string;
  isConversion?: boolean;
  paramsSchema?: Record<string, unknown>;
  applicableCategories?: TrackingComponentCategory[];
  defaultProviders?: string[];
}

function rowToDefinition(
  row: typeof schema.trackingEventDefinitions.$inferSelect,
): TrackingEventDefinition {
  return {
    id: row.id,
    name: row.name,
    category: row.category as TrackingEventCategory,
    scope: row.scope as TrackingEventScope,
    description: row.description,
    isConversion: row.isConversion,
    paramsSchema: (row.paramsSchema as Record<string, unknown>) ?? {},
    applicableCategories: (row.applicableCategories as TrackingComponentCategory[]) ?? [],
    defaultProviders: (row.defaultProviders as string[]) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findEventDefinitionByName(
  name: string,
): Promise<TrackingEventDefinition | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingEventDefinitions)
      .where(eq(schema.trackingEventDefinitions.name, name))
      .limit(1);
    return rows[0] ? rowToDefinition(rows[0]) : null;
  }
  for (const def of memoryStore().trackingEventDefinitions.values()) {
    if (def.name === name) return def;
  }
  return null;
}

export async function listEventDefinitions(): Promise<TrackingEventDefinition[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingEventDefinitions)
      .orderBy(asc(schema.trackingEventDefinitions.category), asc(schema.trackingEventDefinitions.name));
    return rows.map(rowToDefinition);
  }
  return Array.from(memoryStore().trackingEventDefinitions.values()).sort((a, b) =>
    `${a.category}:${a.name}`.localeCompare(`${b.category}:${b.name}`),
  );
}

export async function upsertEventDefinition(
  input: UpsertTrackingEventDefinitionInput,
): Promise<TrackingEventDefinition> {
  const existing = await findEventDefinitionByName(input.name);
  const now = new Date();
  if (existing) {
    const updated: TrackingEventDefinition = {
      ...existing,
      category: input.category,
      scope: input.scope ?? existing.scope,
      description: input.description,
      isConversion: input.isConversion ?? existing.isConversion,
      paramsSchema: input.paramsSchema ?? existing.paramsSchema,
      applicableCategories: input.applicableCategories ?? existing.applicableCategories,
      defaultProviders: input.defaultProviders ?? existing.defaultProviders,
      updatedAt: now,
    };
    const drizzle = db();
    if (drizzle) {
      await drizzle
        .update(schema.trackingEventDefinitions)
        .set({
          category: updated.category,
          scope: updated.scope,
          description: updated.description,
          isConversion: updated.isConversion,
          paramsSchema: updated.paramsSchema,
          applicableCategories: updated.applicableCategories,
          defaultProviders: updated.defaultProviders,
          updatedAt: now,
        })
        .where(eq(schema.trackingEventDefinitions.id, existing.id));
    } else {
      memoryStore().trackingEventDefinitions.set(existing.id, updated);
    }
    return updated;
  }
  const def: TrackingEventDefinition = {
    id: createId('ted'),
    name: input.name,
    category: input.category,
    scope: input.scope ?? 'web',
    description: input.description,
    isConversion: input.isConversion ?? false,
    paramsSchema: input.paramsSchema ?? {},
    applicableCategories: input.applicableCategories ?? [],
    defaultProviders: input.defaultProviders ?? [],
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.trackingEventDefinitions).values({
      id: def.id,
      name: def.name,
      category: def.category,
      scope: def.scope,
      description: def.description,
      isConversion: def.isConversion,
      paramsSchema: def.paramsSchema,
      applicableCategories: def.applicableCategories,
      defaultProviders: def.defaultProviders,
      createdAt: def.createdAt,
      updatedAt: def.updatedAt,
    });
  } else {
    memoryStore().trackingEventDefinitions.set(def.id, def);
  }
  return def;
}

export async function deleteEventDefinition(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.trackingEventDefinitions).where(eq(schema.trackingEventDefinitions.id, id));
  } else {
    memoryStore().trackingEventDefinitions.delete(id);
  }
}

export async function countEventDefinitions(): Promise<number> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select({ id: schema.trackingEventDefinitions.id }).from(schema.trackingEventDefinitions);
    return rows.length;
  }
  return memoryStore().trackingEventDefinitions.size;
}
