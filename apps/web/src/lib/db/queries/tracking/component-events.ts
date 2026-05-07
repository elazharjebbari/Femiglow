import { and, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { TrackingComponentEvent } from '@/lib/db/types';

export interface UpsertComponentEventInput {
  componentId: string;
  eventDefinitionId: string;
  enabled?: boolean;
  paramsOverride?: Record<string, unknown>;
  providersOverride?: string[] | null;
}

function rowToComponentEvent(
  row: typeof schema.trackingComponentEvents.$inferSelect,
): TrackingComponentEvent {
  return {
    id: row.id,
    componentId: row.componentId,
    eventDefinitionId: row.eventDefinitionId,
    enabled: row.enabled,
    paramsOverride: (row.paramsOverride as Record<string, unknown>) ?? {},
    providersOverride: (row.providersOverride as string[] | null) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findComponentEvent(
  componentId: string,
  eventDefinitionId: string,
): Promise<TrackingComponentEvent | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingComponentEvents)
      .where(
        and(
          eq(schema.trackingComponentEvents.componentId, componentId),
          eq(schema.trackingComponentEvents.eventDefinitionId, eventDefinitionId),
        ),
      )
      .limit(1);
    return rows[0] ? rowToComponentEvent(rows[0]) : null;
  }
  for (const ce of memoryStore().trackingComponentEvents.values()) {
    if (ce.componentId === componentId && ce.eventDefinitionId === eventDefinitionId) return ce;
  }
  return null;
}

export async function listEventsForComponent(componentId: string): Promise<TrackingComponentEvent[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingComponentEvents)
      .where(eq(schema.trackingComponentEvents.componentId, componentId));
    return rows.map(rowToComponentEvent);
  }
  return Array.from(memoryStore().trackingComponentEvents.values()).filter(
    (ce) => ce.componentId === componentId,
  );
}

export async function upsertComponentEvent(
  input: UpsertComponentEventInput,
): Promise<TrackingComponentEvent> {
  const existing = await findComponentEvent(input.componentId, input.eventDefinitionId);
  const now = new Date();
  if (existing) {
    const updated: TrackingComponentEvent = {
      ...existing,
      enabled: input.enabled ?? existing.enabled,
      paramsOverride: input.paramsOverride ?? existing.paramsOverride,
      providersOverride:
        input.providersOverride !== undefined ? input.providersOverride : existing.providersOverride,
      updatedAt: now,
    };
    const drizzle = db();
    if (drizzle) {
      await drizzle
        .update(schema.trackingComponentEvents)
        .set({
          enabled: updated.enabled,
          paramsOverride: updated.paramsOverride,
          providersOverride: updated.providersOverride,
          updatedAt: now,
        })
        .where(eq(schema.trackingComponentEvents.id, existing.id));
    } else {
      memoryStore().trackingComponentEvents.set(existing.id, updated);
    }
    return updated;
  }
  const ce: TrackingComponentEvent = {
    id: createId('tce'),
    componentId: input.componentId,
    eventDefinitionId: input.eventDefinitionId,
    enabled: input.enabled ?? true,
    paramsOverride: input.paramsOverride ?? {},
    providersOverride: input.providersOverride ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.trackingComponentEvents).values({
      id: ce.id,
      componentId: ce.componentId,
      eventDefinitionId: ce.eventDefinitionId,
      enabled: ce.enabled,
      paramsOverride: ce.paramsOverride,
      providersOverride: ce.providersOverride,
      createdAt: ce.createdAt,
      updatedAt: ce.updatedAt,
    });
  } else {
    memoryStore().trackingComponentEvents.set(ce.id, ce);
  }
  return ce;
}

export async function deleteComponentEvent(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.trackingComponentEvents).where(eq(schema.trackingComponentEvents.id, id));
  } else {
    memoryStore().trackingComponentEvents.delete(id);
  }
}
