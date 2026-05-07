/**
 * Queries — `component_media_bindings` (rattachement composant ↔ media par slot).
 *
 * Modèle : UNIQUE(componentId, slot) — un seul binding par slot. Pour
 * désactiver sans supprimer, mettre `isActive=false`.
 */
import { and, asc, eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type {
  ComponentMediaBinding,
  ComponentMediaBindingWithMedia,
  Media,
  PlaceholderStrategy,
  MediaLoadingStrategy,
  MediaObjectFit,
  MediaObjectPosition,
  FetchPriority,
} from '@/lib/db/types';
import { findMediaById, thumbsByMediaId } from './media';

export interface UpsertBindingInput {
  componentId: string;
  slot: string;
  mediaId: string | null;
  loadingStrategy?: MediaLoadingStrategy;
  fetchPriority?: FetchPriority;
  priority?: boolean;
  placeholderStrategy?: PlaceholderStrategy;
  customAlt?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  notes?: string | null;
  objectFit?: MediaObjectFit;
  objectPosition?: MediaObjectPosition;
  focalX?: number | null;
  focalY?: number | null;
  /** Override point-d'usage pour la couleur de fond (cf. cascade fit). */
  backgroundFill?: string | null;
  createdBy?: string | null;
}

function toRecord(row: unknown): ComponentMediaBinding {
  return row as ComponentMediaBinding;
}

export async function listBindingsByComponent(
  componentId: string,
): Promise<ComponentMediaBinding[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentMediaBindings)
      .where(eq(schema.componentMediaBindings.componentId, componentId))
      .orderBy(asc(schema.componentMediaBindings.displayOrder));
    return rows.map(toRecord);
  }
  return Array.from(memoryStore().componentMediaBindings.values())
    .filter((b) => b.componentId === componentId)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function listBindingsWithMediaByComponent(
  componentId: string,
): Promise<ComponentMediaBindingWithMedia[]> {
  const bindings = await listBindingsByComponent(componentId);
  const mediaIds: string[] = [];
  const mediaCache = new Map<string, Media>();
  for (const b of bindings) {
    if (!b.mediaId || mediaCache.has(b.mediaId)) continue;
    const m = await findMediaById(b.mediaId);
    if (m) {
      mediaCache.set(b.mediaId, m);
      mediaIds.push(b.mediaId);
    }
  }
  const thumbs = await thumbsByMediaId(mediaIds);
  const enriched: ComponentMediaBindingWithMedia[] = [];
  for (const b of bindings) {
    const media = b.mediaId ? (mediaCache.get(b.mediaId) ?? null) : null;
    if (media) {
      const thumbUrl = thumbs.get(media.id);
      enriched.push({ ...b, media: { ...media, thumbUrl } });
    } else {
      enriched.push({ ...b, media: null });
    }
  }
  return enriched;
}

export async function getBindingBySlot(
  componentId: string,
  slot: string,
): Promise<ComponentMediaBinding | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentMediaBindings)
      .where(
        and(
          eq(schema.componentMediaBindings.componentId, componentId),
          eq(schema.componentMediaBindings.slot, slot),
        ),
      )
      .limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }
  for (const b of memoryStore().componentMediaBindings.values()) {
    if (b.componentId === componentId && b.slot === slot) return b;
  }
  return null;
}

export async function getActiveBindingWithMedia(
  componentId: string,
  slot: string,
): Promise<{ binding: ComponentMediaBinding; media: Media | null } | null> {
  const binding = await getBindingBySlot(componentId, slot);
  if (!binding || !binding.isActive) return null;
  const media = binding.mediaId ? await findMediaById(binding.mediaId) : null;
  return { binding, media };
}

export async function upsertBinding(
  input: UpsertBindingInput,
): Promise<ComponentMediaBinding> {
  const existing = await getBindingBySlot(input.componentId, input.slot);
  const now = new Date();

  if (existing) {
    const updated: ComponentMediaBinding = {
      ...existing,
      mediaId: input.mediaId ?? existing.mediaId,
      loadingStrategy: input.loadingStrategy ?? existing.loadingStrategy,
      fetchPriority: input.fetchPriority ?? existing.fetchPriority,
      priority: input.priority ?? existing.priority,
      placeholderStrategy: input.placeholderStrategy ?? existing.placeholderStrategy,
      customAlt: input.customAlt ?? existing.customAlt,
      displayOrder: input.displayOrder ?? existing.displayOrder,
      isActive: input.isActive ?? existing.isActive,
      notes: input.notes ?? existing.notes,
      objectFit: input.objectFit ?? existing.objectFit,
      objectPosition: input.objectPosition ?? existing.objectPosition,
      focalX: input.focalX === undefined ? existing.focalX : input.focalX,
      focalY: input.focalY === undefined ? existing.focalY : input.focalY,
      backgroundFill:
        input.backgroundFill === undefined ? existing.backgroundFill : input.backgroundFill,
      updatedAt: now,
    };
    const drizzle = db();
    if (drizzle) {
      await drizzle
        .update(schema.componentMediaBindings)
        .set({
          mediaId: updated.mediaId,
          loadingStrategy: updated.loadingStrategy,
          fetchPriority: updated.fetchPriority,
          priority: updated.priority,
          placeholderStrategy: updated.placeholderStrategy,
          customAlt: updated.customAlt,
          displayOrder: updated.displayOrder,
          isActive: updated.isActive,
          notes: updated.notes,
          objectFit: updated.objectFit,
          objectPosition: updated.objectPosition,
          focalX: updated.focalX,
          focalY: updated.focalY,
          backgroundFill: updated.backgroundFill,
          updatedAt: now,
        })
        .where(eq(schema.componentMediaBindings.id, existing.id));
      return updated;
    }
    memoryStore().componentMediaBindings.set(existing.id, updated);
    return updated;
  }

  const created: ComponentMediaBinding = {
    id: createId('bnd'),
    componentId: input.componentId,
    slot: input.slot,
    mediaId: input.mediaId ?? null,
    loadingStrategy: input.loadingStrategy ?? 'viewport',
    fetchPriority: input.fetchPriority ?? 'auto',
    priority: input.priority ?? false,
    placeholderStrategy: input.placeholderStrategy ?? 'svg',
    customAlt: input.customAlt ?? null,
    displayOrder: input.displayOrder ?? 0,
    isActive: input.isActive ?? false,
    notes: input.notes ?? null,
    objectFit: input.objectFit ?? 'cover',
    objectPosition: input.objectPosition ?? 'center',
    focalX: input.focalX ?? null,
    focalY: input.focalY ?? null,
    backgroundFill: input.backgroundFill ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.componentMediaBindings).values(created);
    return created;
  }
  memoryStore().componentMediaBindings.set(created.id, created);
  return created;
}

export async function deleteBinding(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.componentMediaBindings).where(eq(schema.componentMediaBindings.id, id));
    return;
  }
  memoryStore().componentMediaBindings.delete(id);
}

export async function setBindingActive(id: string, isActive: boolean): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.componentMediaBindings)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(schema.componentMediaBindings.id, id));
    return;
  }
  const store = memoryStore();
  const b = store.componentMediaBindings.get(id);
  if (b) store.componentMediaBindings.set(id, { ...b, isActive, updatedAt: new Date() });
}

export async function listBindingsForMedia(mediaId: string): Promise<ComponentMediaBinding[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.componentMediaBindings)
      .where(eq(schema.componentMediaBindings.mediaId, mediaId));
    return rows.map(toRecord);
  }
  return Array.from(memoryStore().componentMediaBindings.values()).filter(
    (b) => b.mediaId === mediaId,
  );
}

/* ─── Bulk operations ───
 * Toutes ces fonctions opèrent sur un set d'IDs et renvoient le nombre
 * effectivement affecté. Toute mutation doit invalider `revalidateTag('components')`
 * côté appelant.
 */

export interface BulkUpdateInput {
  loadingStrategy?: MediaLoadingStrategy;
  fetchPriority?: FetchPriority;
  placeholderStrategy?: PlaceholderStrategy;
  objectFit?: MediaObjectFit;
  objectPosition?: MediaObjectPosition;
  focalX?: number | null;
  focalY?: number | null;
  backgroundFill?: string | null;
}

export async function bulkSetActive(ids: string[], isActive: boolean): Promise<number> {
  if (ids.length === 0) return 0;
  let count = 0;
  for (const id of ids) {
    await setBindingActive(id, isActive);
    count += 1;
  }
  return count;
}

export async function bulkDelete(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  let count = 0;
  for (const id of ids) {
    await deleteBinding(id);
    count += 1;
  }
  return count;
}

export async function bulkUpdate(ids: string[], patch: BulkUpdateInput): Promise<number> {
  if (ids.length === 0) return 0;
  const now = new Date();
  let count = 0;
  const drizzle = db();
  if (drizzle) {
    for (const id of ids) {
      await drizzle
        .update(schema.componentMediaBindings)
        .set({ ...patch, updatedAt: now })
        .where(eq(schema.componentMediaBindings.id, id));
      count += 1;
    }
    return count;
  }
  const store = memoryStore().componentMediaBindings;
  for (const id of ids) {
    const b = store.get(id);
    if (!b) continue;
    store.set(id, {
      ...b,
      loadingStrategy: patch.loadingStrategy ?? b.loadingStrategy,
      fetchPriority: patch.fetchPriority ?? b.fetchPriority,
      placeholderStrategy: patch.placeholderStrategy ?? b.placeholderStrategy,
      objectFit: patch.objectFit ?? b.objectFit,
      objectPosition: patch.objectPosition ?? b.objectPosition,
      focalX: patch.focalX === undefined ? b.focalX : patch.focalX,
      focalY: patch.focalY === undefined ? b.focalY : patch.focalY,
      backgroundFill:
        patch.backgroundFill === undefined ? b.backgroundFill : patch.backgroundFill,
      updatedAt: now,
    });
    count += 1;
  }
  return count;
}
