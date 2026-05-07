import { and, asc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { MediaTag } from '@/lib/db/types';
import { normalizeSlug } from './media';

export interface CreateTagInput {
  name: string;
  color?: string | null;
}

export async function listTags(): Promise<MediaTag[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(schema.mediaTags).orderBy(asc(schema.mediaTags.name));
    return rows as unknown as MediaTag[];
  }
  return Array.from(memoryStore().mediaTags.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function findTagByName(name: string): Promise<MediaTag | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.mediaTags)
      .where(eq(schema.mediaTags.name, name))
      .limit(1);
    return (rows[0] as unknown as MediaTag | undefined) ?? null;
  }
  for (const t of memoryStore().mediaTags.values()) if (t.name === name) return t;
  return null;
}

export async function findTagById(id: string): Promise<MediaTag | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.mediaTags)
      .where(eq(schema.mediaTags.id, id))
      .limit(1);
    return (rows[0] as unknown as MediaTag | undefined) ?? null;
  }
  return memoryStore().mediaTags.get(id) ?? null;
}

export async function createTag(input: CreateTagInput): Promise<MediaTag> {
  const name = normalizeSlug(input.name);
  const existing = await findTagByName(name);
  if (existing) return existing;
  const tag: MediaTag = {
    id: createId('mt'),
    name,
    color: input.color ?? null,
    createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.mediaTags).values(tag);
    return tag;
  }
  memoryStore().mediaTags.set(tag.id, tag);
  return tag;
}

export async function getOrCreateTagsByName(names: string[]): Promise<MediaTag[]> {
  const result: MediaTag[] = [];
  for (const raw of names) {
    const name = normalizeSlug(raw);
    if (!name) continue;
    const tag = (await findTagByName(name)) ?? (await createTag({ name }));
    result.push(tag);
  }
  return result;
}

export async function attachTags(mediaId: string, tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;
  const drizzle = db();
  if (drizzle) {
    const values = tagIds.map((tagId) => ({ mediaId, tagId }));
    await drizzle.insert(schema.mediaToTags).values(values).onConflictDoNothing();
    return;
  }
  const store = memoryStore();
  for (const tagId of tagIds) store.mediaToTags.add(`${mediaId}:${tagId}`);
}

export async function detachTags(mediaId: string, tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;
  const drizzle = db();
  if (drizzle) {
    for (const tagId of tagIds) {
      await drizzle
        .delete(schema.mediaToTags)
        .where(
          and(eq(schema.mediaToTags.mediaId, mediaId), eq(schema.mediaToTags.tagId, tagId)),
        );
    }
    return;
  }
  const store = memoryStore();
  for (const tagId of tagIds) store.mediaToTags.delete(`${mediaId}:${tagId}`);
}

export async function setTags(mediaId: string, tagIds: string[]): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.mediaToTags).where(eq(schema.mediaToTags.mediaId, mediaId));
    if (tagIds.length === 0) return;
    await drizzle
      .insert(schema.mediaToTags)
      .values(tagIds.map((tagId) => ({ mediaId, tagId })))
      .onConflictDoNothing();
    return;
  }
  const store = memoryStore();
  for (const link of Array.from(store.mediaToTags)) {
    if (link.startsWith(`${mediaId}:`)) store.mediaToTags.delete(link);
  }
  for (const tagId of tagIds) store.mediaToTags.add(`${mediaId}:${tagId}`);
}

export async function deleteTag(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.mediaTags).where(eq(schema.mediaTags.id, id));
    return;
  }
  const store = memoryStore();
  store.mediaTags.delete(id);
  for (const link of Array.from(store.mediaToTags)) {
    if (link.endsWith(`:${id}`)) store.mediaToTags.delete(link);
  }
}
