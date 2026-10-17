/**
 * Repo Stories vidéo — dual driver (Drizzle si DATABASE_URL, sinon memoryStore).
 * Pattern `coupon-repo.ts` : extension paresseuse du memoryStore via `ext()`.
 * L'admin voit TOUTES les stories/segments (actifs ou non) ; le feed public
 * (`getStoriesFeed`) refiltre `isActive`.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';

import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { MediaStoryRow, MediaStorySegmentRow } from '@/lib/db/schema';
import type {
  StoryInput,
  StoryPatch,
  StorySegmentInput,
  StorySegmentPatch,
} from '@/lib/stories/schemas';

export type StoryWithSegments = MediaStoryRow & { segments: MediaStorySegmentRow[] };

interface ExtendedStore {
  stories: Map<string, MediaStoryRow>;
  storySegments: Map<string, MediaStorySegmentRow>;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.stories) store.stories = new Map();
  if (!store.storySegments) store.storySegments = new Map();
  return store;
}

const byOrder = <T extends { displayOrder: number }>(a: T, b: T) => a.displayOrder - b.displayOrder;

// ─── Stories ────────────────────────────────────────────────────────────────

export async function listStories(pageGroup = 'kit'): Promise<StoryWithSegments[]> {
  const drizzle = db();
  if (drizzle) {
    const storyRows = await drizzle
      .select()
      .from(schema.mediaStory)
      .where(eq(schema.mediaStory.pageGroup, pageGroup))
      .orderBy(asc(schema.mediaStory.displayOrder));
    if (storyRows.length === 0) return [];
    const ids = storyRows.map((s) => s.id);
    const segRows = await drizzle
      .select()
      .from(schema.mediaStorySegment)
      .where(inArray(schema.mediaStorySegment.storyId, ids))
      .orderBy(asc(schema.mediaStorySegment.displayOrder));
    return storyRows.map((s) => ({
      ...s,
      segments: segRows.filter((g) => g.storyId === s.id),
    }));
  }
  const store = ext();
  return [...store.stories.values()]
    .filter((s) => s.pageGroup === pageGroup)
    .sort(byOrder)
    .map((s) => ({
      ...s,
      segments: [...store.storySegments.values()]
        .filter((g) => g.storyId === s.id)
        .sort(byOrder),
    }));
}

export async function getStory(id: string): Promise<StoryWithSegments | null> {
  const drizzle = db();
  if (drizzle) {
    const [row] = await drizzle
      .select()
      .from(schema.mediaStory)
      .where(eq(schema.mediaStory.id, id))
      .limit(1);
    if (!row) return null;
    const segs = await drizzle
      .select()
      .from(schema.mediaStorySegment)
      .where(eq(schema.mediaStorySegment.storyId, id))
      .orderBy(asc(schema.mediaStorySegment.displayOrder));
    return { ...row, segments: segs };
  }
  const store = ext();
  const row = store.stories.get(id);
  if (!row) return null;
  return {
    ...row,
    segments: [...store.storySegments.values()].filter((g) => g.storyId === id).sort(byOrder),
  };
}

export async function createStory(input: StoryInput): Promise<MediaStoryRow> {
  const now = new Date();
  const row: MediaStoryRow = {
    id: createId('sty'),
    slug: input.slug,
    pageGroup: input.pageGroup,
    titleI18n: input.titleI18n,
    bubblePosterUrl: input.bubblePosterUrl,
    bubbleMediaId: null,
    accent: input.accent ?? null,
    displayOrder: input.displayOrder,
    isActive: input.isActive,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) await drizzle.insert(schema.mediaStory).values(row);
  else ext().stories.set(row.id, row);
  return row;
}

export async function updateStory(id: string, patch: StoryPatch): Promise<MediaStoryRow | null> {
  const set: Partial<MediaStoryRow> = { updatedAt: new Date() };
  if (patch.slug !== undefined) set.slug = patch.slug;
  if (patch.pageGroup !== undefined) set.pageGroup = patch.pageGroup;
  if (patch.titleI18n !== undefined) set.titleI18n = patch.titleI18n;
  if (patch.bubblePosterUrl !== undefined) set.bubblePosterUrl = patch.bubblePosterUrl;
  if (patch.accent !== undefined) set.accent = patch.accent ?? null;
  if (patch.displayOrder !== undefined) set.displayOrder = patch.displayOrder;
  if (patch.isActive !== undefined) set.isActive = patch.isActive;

  const drizzle = db();
  if (drizzle) {
    await drizzle.update(schema.mediaStory).set(set).where(eq(schema.mediaStory.id, id));
    const [row] = await drizzle
      .select()
      .from(schema.mediaStory)
      .where(eq(schema.mediaStory.id, id))
      .limit(1);
    return row ?? null;
  }
  const store = ext();
  const existing = store.stories.get(id);
  if (!existing) return null;
  const merged = { ...existing, ...set } as MediaStoryRow;
  store.stories.set(id, merged);
  return merged;
}

export async function deleteStory(id: string): Promise<boolean> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.mediaStory).where(eq(schema.mediaStory.id, id));
    return true;
  }
  const store = ext();
  for (const [segId, seg] of store.storySegments) {
    if (seg.storyId === id) store.storySegments.delete(segId);
  }
  return store.stories.delete(id);
}

// ─── Segments ─────────────────────────────────────────────────────────────

export async function createSegment(
  storyId: string,
  input: StorySegmentInput,
): Promise<MediaStorySegmentRow> {
  const now = new Date();
  const row: MediaStorySegmentRow = {
    id: createId('seg'),
    storyId,
    mediaId: null,
    videoUrl: input.videoUrl,
    webmUrl: input.webmUrl ?? null,
    posterUrl: input.posterUrl,
    durationMs: input.durationMs,
    width: input.width ?? null,
    height: input.height ?? null,
    captionI18n: input.captionI18n,
    ctaLabelI18n: input.ctaLabelI18n,
    ctaTarget: input.ctaTarget ?? null,
    displayOrder: input.displayOrder,
    isActive: input.isActive,
    createdAt: now,
    updatedAt: now,
  };
  const drizzle = db();
  if (drizzle) await drizzle.insert(schema.mediaStorySegment).values(row);
  else ext().storySegments.set(row.id, row);
  return row;
}

export async function updateSegment(
  segId: string,
  patch: StorySegmentPatch,
): Promise<MediaStorySegmentRow | null> {
  const set: Partial<MediaStorySegmentRow> = { updatedAt: new Date() };
  if (patch.videoUrl !== undefined) set.videoUrl = patch.videoUrl;
  if (patch.webmUrl !== undefined) set.webmUrl = patch.webmUrl ?? null;
  if (patch.posterUrl !== undefined) set.posterUrl = patch.posterUrl;
  if (patch.durationMs !== undefined) set.durationMs = patch.durationMs;
  if (patch.width !== undefined) set.width = patch.width ?? null;
  if (patch.height !== undefined) set.height = patch.height ?? null;
  if (patch.captionI18n !== undefined) set.captionI18n = patch.captionI18n;
  if (patch.ctaLabelI18n !== undefined) set.ctaLabelI18n = patch.ctaLabelI18n;
  if (patch.ctaTarget !== undefined) set.ctaTarget = patch.ctaTarget ?? null;
  if (patch.displayOrder !== undefined) set.displayOrder = patch.displayOrder;
  if (patch.isActive !== undefined) set.isActive = patch.isActive;

  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.mediaStorySegment)
      .set(set)
      .where(eq(schema.mediaStorySegment.id, segId));
    const [row] = await drizzle
      .select()
      .from(schema.mediaStorySegment)
      .where(eq(schema.mediaStorySegment.id, segId))
      .limit(1);
    return row ?? null;
  }
  const store = ext();
  const existing = store.storySegments.get(segId);
  if (!existing) return null;
  const merged = { ...existing, ...set } as MediaStorySegmentRow;
  store.storySegments.set(segId, merged);
  return merged;
}

export async function deleteSegment(segId: string): Promise<boolean> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.mediaStorySegment).where(eq(schema.mediaStorySegment.id, segId));
    return true;
  }
  return ext().storySegments.delete(segId);
}

// util interne exposé pour la garde « segment appartient à la story ».
export async function segmentBelongsTo(segId: string, storyId: string): Promise<boolean> {
  const drizzle = db();
  if (drizzle) {
    const [row] = await drizzle
      .select({ id: schema.mediaStorySegment.id })
      .from(schema.mediaStorySegment)
      .where(
        and(
          eq(schema.mediaStorySegment.id, segId),
          eq(schema.mediaStorySegment.storyId, storyId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
  return ext().storySegments.get(segId)?.storyId === storyId;
}
