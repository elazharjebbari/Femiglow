import { asc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { TrackingPage } from '@/lib/db/types';

export interface UpsertTrackingPageInput {
  route: string;
  title: string;
  category: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateTrackingPageInput {
  title?: string;
  category?: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

function rowToPage(row: typeof schema.trackingPages.$inferSelect): TrackingPage {
  return {
    id: row.id,
    route: row.route,
    title: row.title,
    category: row.category,
    enabled: row.enabled,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findTrackingPageById(id: string): Promise<TrackingPage | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(schema.trackingPages).where(eq(schema.trackingPages.id, id)).limit(1);
    return rows[0] ? rowToPage(rows[0]) : null;
  }
  return memoryStore().trackingPages.get(id) ?? null;
}

export async function findTrackingPageByRoute(route: string): Promise<TrackingPage | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingPages)
      .where(eq(schema.trackingPages.route, route))
      .limit(1);
    return rows[0] ? rowToPage(rows[0]) : null;
  }
  for (const page of memoryStore().trackingPages.values()) {
    if (page.route === route) return page;
  }
  return null;
}

export async function listTrackingPages(): Promise<TrackingPage[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(schema.trackingPages).orderBy(asc(schema.trackingPages.route));
    return rows.map(rowToPage);
  }
  return Array.from(memoryStore().trackingPages.values()).sort((a, b) => a.route.localeCompare(b.route));
}

export async function upsertTrackingPage(input: UpsertTrackingPageInput): Promise<TrackingPage> {
  const existing = await findTrackingPageByRoute(input.route);
  const now = new Date();
  if (existing) {
    return updateTrackingPage(existing.id, {
      title: input.title,
      category: input.category,
      enabled: input.enabled,
      metadata: input.metadata,
    });
  }
  const page: TrackingPage = {
    id: createId('tp'),
    route: input.route,
    title: input.title,
    category: input.category,
    enabled: input.enabled ?? true,
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.trackingPages).values({
      id: page.id,
      route: page.route,
      title: page.title,
      category: page.category,
      enabled: page.enabled,
      metadata: page.metadata,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    });
  } else {
    memoryStore().trackingPages.set(page.id, page);
  }
  return page;
}

export async function updateTrackingPage(
  id: string,
  input: UpdateTrackingPageInput,
): Promise<TrackingPage> {
  const existing = await findTrackingPageById(id);
  if (!existing) throw new Error(`tracking page ${id} not found`);
  const updated: TrackingPage = {
    ...existing,
    title: input.title ?? existing.title,
    category: input.category ?? existing.category,
    enabled: input.enabled ?? existing.enabled,
    metadata: input.metadata ?? existing.metadata,
    updatedAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.trackingPages)
      .set({
        title: updated.title,
        category: updated.category,
        enabled: updated.enabled,
        metadata: updated.metadata,
        updatedAt: updated.updatedAt,
      })
      .where(eq(schema.trackingPages.id, id));
  } else {
    memoryStore().trackingPages.set(id, updated);
  }
  return updated;
}

export async function deleteTrackingPage(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.trackingPages).where(eq(schema.trackingPages.id, id));
  } else {
    memoryStore().trackingPages.delete(id);
  }
}
