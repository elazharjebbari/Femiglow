import { and, eq, lte } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { MediaContext, MediaUsage, MediaUsageType } from '@/lib/db/types';

export interface RecordUsageInput {
  mediaId: string;
  usageType: MediaUsageType;
  route: string;
  component: string;
  context: MediaContext;
}

export async function recordUsage(input: RecordUsageInput): Promise<MediaUsage> {
  const drizzle = db();
  const now = new Date();
  if (drizzle) {
    const usage: MediaUsage = {
      id: createId('mu'),
      mediaId: input.mediaId,
      usageType: input.usageType,
      route: input.route,
      component: input.component,
      context: input.context,
      lastSeenAt: now,
      createdAt: now,
    };
    await drizzle
      .insert(schema.mediaUsages)
      .values(usage)
      .onConflictDoUpdate({
        target: [schema.mediaUsages.mediaId, schema.mediaUsages.route, schema.mediaUsages.component],
        set: { lastSeenAt: now },
      });
    return usage;
  }
  const store = memoryStore();
  for (const u of store.mediaUsages.values()) {
    if (u.mediaId === input.mediaId && u.route === input.route && u.component === input.component) {
      const next: MediaUsage = { ...u, lastSeenAt: now };
      store.mediaUsages.set(u.id, next);
      return next;
    }
  }
  const usage: MediaUsage = {
    id: createId('mu'),
    mediaId: input.mediaId,
    usageType: input.usageType,
    route: input.route,
    component: input.component,
    context: input.context,
    lastSeenAt: now,
    createdAt: now,
  };
  store.mediaUsages.set(usage.id, usage);
  return usage;
}

export async function listUsagesForMedia(mediaId: string): Promise<MediaUsage[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.mediaUsages)
      .where(eq(schema.mediaUsages.mediaId, mediaId));
    return rows as unknown as MediaUsage[];
  }
  return Array.from(memoryStore().mediaUsages.values()).filter((u) => u.mediaId === mediaId);
}

export async function countUsagesForMedia(mediaId: string): Promise<number> {
  const usages = await listUsagesForMedia(mediaId);
  return usages.length;
}

export async function deleteUsagesForMedia(mediaId: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.mediaUsages).where(eq(schema.mediaUsages.mediaId, mediaId));
    return;
  }
  const store = memoryStore();
  for (const u of Array.from(store.mediaUsages.values())) {
    if (u.mediaId === mediaId) store.mediaUsages.delete(u.id);
  }
}

export async function listUnusedMedia(beforeDate: Date): Promise<string[]> {
  const drizzle = db();
  if (drizzle) {
    const allMedia = await drizzle.select({ id: schema.media.id }).from(schema.media);
    const usedRows = await drizzle
      .select({ mediaId: schema.mediaUsages.mediaId })
      .from(schema.mediaUsages)
      .where(and(lte(schema.mediaUsages.lastSeenAt, beforeDate)));
    const usedSet = new Set(usedRows.map((r) => r.mediaId));
    return allMedia.map((m) => m.id).filter((id) => !usedSet.has(id));
  }
  const store = memoryStore();
  const usedSet = new Set<string>();
  for (const u of store.mediaUsages.values()) {
    if (u.lastSeenAt > beforeDate) usedSet.add(u.mediaId);
  }
  return Array.from(store.media.keys()).filter((id) => !usedSet.has(id));
}
