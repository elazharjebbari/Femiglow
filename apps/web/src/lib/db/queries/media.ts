import { and, asc, desc, eq, ilike, inArray, isNull, or, sql as dsql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type {
  Media,
  MediaKind,
  MediaLoadingStrategy,
  MediaOverrides,
  MediaQualityProfile,
  MediaSource,
  MediaStatus,
  MediaTag,
  MediaVariant,
  MediaWithRelations,
  PaletteEntry,
  VariantBreakpoint,
  VariantFormat,
} from '@/lib/db/types';

export interface MediaFilters {
  q?: string;
  kind?: MediaKind;
  status?: MediaStatus;
  tag?: string;
  isHero?: boolean;
  unused?: boolean;
  includeDeleted?: boolean;
  cursor?: string;
  limit?: number;
  sort?: 'created_desc' | 'created_asc' | 'size_desc' | 'most_used';
}

export interface MediaListResult {
  rows: Media[];
  total: number;
  nextCursor: string | null;
}

export interface CreateMediaInput {
  kind: MediaKind;
  source: MediaSource;
  slug: string;
  alt: string;
  originalUrl?: string | null;
  originalFilename?: string | null;
  originalSizeBytes?: number | null;
  originalMime?: string | null;
  originalWidth?: number | null;
  originalHeight?: number | null;
  originalDurationMs?: number | null;
  caption?: string | null;
  credit?: string | null;
  status?: MediaStatus;
  qualityProfile?: MediaQualityProfile;
  loadingStrategy?: MediaLoadingStrategy;
  isHero?: boolean;
  overrides?: MediaOverrides;
  createdBy?: string | null;
}

export interface UpdateMediaInput {
  alt?: string;
  caption?: string | null;
  credit?: string | null;
  status?: MediaStatus;
  failureReason?: string | null;
  qualityProfile?: MediaQualityProfile;
  loadingStrategy?: MediaLoadingStrategy;
  isHero?: boolean;
  overrides?: MediaOverrides;
  blurhash?: string | null;
  palette?: PaletteEntry[];
  phash?: string | null;
  originalWidth?: number | null;
  originalHeight?: number | null;
  originalDurationMs?: number | null;
  originalSizeBytes?: number | null;
  originalMime?: string | null;
}

function makeMedia(input: CreateMediaInput): Media {
  const now = new Date();
  return {
    id: createId('me'),
    kind: input.kind,
    source: input.source,
    slug: normalizeSlug(input.slug),
    originalUrl: input.originalUrl ?? null,
    originalFilename: input.originalFilename ?? null,
    originalSizeBytes: input.originalSizeBytes ?? null,
    originalMime: input.originalMime ?? null,
    originalWidth: input.originalWidth ?? null,
    originalHeight: input.originalHeight ?? null,
    originalDurationMs: input.originalDurationMs ?? null,
    phash: null,
    blurhash: null,
    palette: [],
    alt: input.alt,
    caption: input.caption ?? null,
    credit: input.credit ?? null,
    status: input.status ?? 'pending',
    failureReason: null,
    qualityProfile: input.qualityProfile ?? 'inline',
    loadingStrategy: input.loadingStrategy ?? 'viewport',
    isHero: input.isHero ?? false,
    overrides: input.overrides ?? {},
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export function normalizeSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function createMedia(input: CreateMediaInput): Promise<Media> {
  const drizzle = db();
  const m = makeMedia(input);

  const conflict = await findMediaBySlug(m.slug);
  if (conflict) {
    throw new Error(`media slug already exists: ${m.slug}`);
  }

  if (drizzle) {
    await drizzle.insert(schema.media).values({
      ...m,
      palette: m.palette as unknown as Record<string, unknown>[],
      overrides: m.overrides as unknown as Record<string, unknown>,
    });
    return m;
  }
  memoryStore().media.set(m.id, m);
  return m;
}

function rowToMedia(row: Record<string, unknown>): Media {
  return {
    ...(row as unknown as Media),
    palette: ((row as { palette?: PaletteEntry[] | null }).palette ?? []) as PaletteEntry[],
    overrides: ((row as { overrides?: MediaOverrides | null }).overrides ?? {}) as MediaOverrides,
  };
}

export async function findMediaById(id: string): Promise<Media | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
    const r = rows[0];
    return r ? rowToMedia(r as Record<string, unknown>) : null;
  }
  return memoryStore().media.get(id) ?? null;
}

export async function findMediaBySlug(
  slug: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<Media | null> {
  const drizzle = db();
  if (drizzle) {
    const where = opts.includeDeleted
      ? eq(schema.media.slug, slug)
      : and(eq(schema.media.slug, slug), isNull(schema.media.deletedAt));
    const rows = await drizzle.select().from(schema.media).where(where).limit(1);
    const r = rows[0];
    return r ? rowToMedia(r as Record<string, unknown>) : null;
  }
  for (const m of memoryStore().media.values()) {
    if (m.slug === slug && (opts.includeDeleted || m.deletedAt === null)) return m;
  }
  return null;
}

export async function findMediaByPhash(
  phash: string,
  opts: { excludeId?: string } = {},
): Promise<Media[]> {
  const drizzle = db();
  if (drizzle) {
    const conditions = [eq(schema.media.phash, phash), isNull(schema.media.deletedAt)];
    const rows = await drizzle
      .select()
      .from(schema.media)
      .where(and(...conditions));
    return rows
      .filter((r) => (opts.excludeId ? (r as { id: string }).id !== opts.excludeId : true))
      .map((r) => rowToMedia(r as Record<string, unknown>));
  }
  return Array.from(memoryStore().media.values()).filter(
    (m) =>
      m.phash === phash && m.deletedAt === null && (!opts.excludeId || m.id !== opts.excludeId),
  );
}

export async function listMedia(filters: MediaFilters = {}): Promise<MediaListResult> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const drizzle = db();
  if (drizzle) {
    const conditions = [] as ReturnType<typeof eq>[];
    if (!filters.includeDeleted) conditions.push(isNull(schema.media.deletedAt));
    if (filters.kind) conditions.push(eq(schema.media.kind, filters.kind));
    if (filters.status) conditions.push(eq(schema.media.status, filters.status));
    if (filters.isHero !== undefined) conditions.push(eq(schema.media.isHero, filters.isHero));
    if (filters.q) {
      const q = `%${filters.q}%`;
      const search = or(
        ilike(schema.media.slug, q),
        ilike(schema.media.alt, q),
        ilike(schema.media.caption, q),
      );
      if (search) conditions.push(search);
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const orderCol =
      filters.sort === 'created_asc' ? asc(schema.media.createdAt) : desc(schema.media.createdAt);
    const rowsQ = drizzle
      .select()
      .from(schema.media)
      .where(where)
      .orderBy(orderCol)
      .limit(limit + 1);
    const totalQ = drizzle
      .select({ c: dsql<number>`count(*)::int` })
      .from(schema.media)
      .where(where);
    const [rows, totalRows] = await Promise.all([rowsQ, totalQ]);
    const hasMore = rows.length > limit;
    const trimmed = hasMore ? rows.slice(0, limit) : rows;
    const last = trimmed[trimmed.length - 1] as { id?: string } | undefined;
    return {
      rows: trimmed.map((r) => rowToMedia(r as Record<string, unknown>)),
      total: totalRows[0]?.c ?? 0,
      nextCursor: hasMore && last?.id ? last.id : null,
    };
  }

  const all = Array.from(memoryStore().media.values());
  let rows = all.filter((m) => {
    if (!filters.includeDeleted && m.deletedAt !== null) return false;
    if (filters.kind && m.kind !== filters.kind) return false;
    if (filters.status && m.status !== filters.status) return false;
    if (filters.isHero !== undefined && m.isHero !== filters.isHero) return false;
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const haystack = `${m.slug} ${m.alt} ${m.caption ?? ''} ${m.credit ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  rows.sort((a, b) =>
    filters.sort === 'created_asc'
      ? a.createdAt.getTime() - b.createdAt.getTime()
      : b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const total = rows.length;
  const trimmed = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return {
    rows: trimmed,
    total,
    nextCursor: hasMore ? (trimmed[trimmed.length - 1]?.id ?? null) : null,
  };
}

export async function updateMedia(id: string, input: UpdateMediaInput): Promise<Media> {
  const drizzle = db();
  const updatedAt = new Date();
  if (drizzle) {
    const patch: Record<string, unknown> = { ...input, updatedAt };
    if (input.palette !== undefined) patch.palette = input.palette;
    if (input.overrides !== undefined) patch.overrides = input.overrides;
    const rows = await drizzle
      .update(schema.media)
      .set(patch)
      .where(eq(schema.media.id, id))
      .returning();
    const r = rows[0];
    if (!r) throw new Error(`media ${id} introuvable`);
    return rowToMedia(r as Record<string, unknown>);
  }
  const store = memoryStore();
  const existing = store.media.get(id);
  if (!existing) throw new Error(`media ${id} introuvable`);
  const next: Media = {
    ...existing,
    ...input,
    palette: input.palette ?? existing.palette,
    overrides: input.overrides ?? existing.overrides,
    updatedAt,
  };
  store.media.set(id, next);
  return next;
}

export async function softDeleteMedia(id: string): Promise<void> {
  const drizzle = db();
  const now = new Date();
  if (drizzle) {
    await drizzle
      .update(schema.media)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(schema.media.id, id));
    return;
  }
  const store = memoryStore();
  const m = store.media.get(id);
  if (!m) return;
  store.media.set(id, { ...m, deletedAt: now, updatedAt: now });
}

export async function restoreMedia(id: string): Promise<void> {
  const drizzle = db();
  const now = new Date();
  if (drizzle) {
    await drizzle
      .update(schema.media)
      .set({ deletedAt: null, updatedAt: now })
      .where(eq(schema.media.id, id));
    return;
  }
  const store = memoryStore();
  const m = store.media.get(id);
  if (!m) return;
  store.media.set(id, { ...m, deletedAt: null, updatedAt: now });
}

export async function hardDeleteMedia(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.media).where(eq(schema.media.id, id));
    return;
  }
  const store = memoryStore();
  store.media.delete(id);
  for (const v of Array.from(store.mediaVariants.values())) {
    if (v.mediaId === id) store.mediaVariants.delete(v.id);
  }
  for (const u of Array.from(store.mediaUsages.values())) {
    if (u.mediaId === id) store.mediaUsages.delete(u.id);
  }
  for (const j of Array.from(store.mediaJobs.values())) {
    if (j.mediaId === id) store.mediaJobs.delete(j.id);
  }
  for (const link of Array.from(store.mediaToTags)) {
    if (link.startsWith(`${id}:`)) store.mediaToTags.delete(link);
  }
}

export async function getMediaWithRelations(id: string): Promise<MediaWithRelations | null> {
  const m = await findMediaById(id);
  if (!m) return null;
  const [variants, tags] = await Promise.all([listVariantsForMedia(id), listTagsForMedia(id)]);
  return { ...m, variants, tags };
}

/**
 * Récupère, en un seul appel, l'URL de la plus petite variant disponible
 * (priorité xs > sm > md > … × avif > webp > jpeg) pour chaque mediaId.
 *
 * Sert à enrichir `listMedia()` côté admin (MediaLibraryGrid, picker)
 * avec une URL de vignette sans charger toutes les variants.
 */
export async function thumbsByMediaId(
  mediaIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (mediaIds.length === 0) return map;

  const THUMB_PRIORITY: VariantBreakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
  const FORMAT_PRIORITY: VariantFormat[] = ['avif', 'webp', 'jpeg'];

  function pickFor(rows: MediaVariant[]): MediaVariant | null {
    for (const bp of THUMB_PRIORITY) {
      for (const fmt of FORMAT_PRIORITY) {
        const v = rows.find((r) => r.breakpoint === bp && r.format === fmt);
        if (v) return v;
      }
    }
    return rows[0] ?? null;
  }

  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.mediaVariants)
      .where(inArray(schema.mediaVariants.mediaId, mediaIds));
    const grouped = new Map<string, MediaVariant[]>();
    for (const r of rows as unknown as MediaVariant[]) {
      const arr = grouped.get(r.mediaId) ?? [];
      arr.push(r);
      grouped.set(r.mediaId, arr);
    }
    for (const [mediaId, variants] of grouped) {
      const picked = pickFor(variants);
      if (picked?.url) map.set(mediaId, picked.url);
    }
    return map;
  }

  const store = memoryStore();
  const grouped = new Map<string, MediaVariant[]>();
  for (const v of store.mediaVariants.values()) {
    if (!mediaIds.includes(v.mediaId)) continue;
    const arr = grouped.get(v.mediaId) ?? [];
    arr.push(v);
    grouped.set(v.mediaId, arr);
  }
  for (const [mediaId, variants] of grouped) {
    const picked = pickFor(variants);
    if (picked?.url) map.set(mediaId, picked.url);
  }
  return map;
}

async function listVariantsForMedia(mediaId: string): Promise<MediaVariant[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.mediaVariants)
      .where(eq(schema.mediaVariants.mediaId, mediaId));
    return rows as unknown as MediaVariant[];
  }
  return Array.from(memoryStore().mediaVariants.values()).filter((v) => v.mediaId === mediaId);
}

async function listTagsForMedia(mediaId: string): Promise<MediaTag[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select({ tag: schema.mediaTags })
      .from(schema.mediaToTags)
      .innerJoin(schema.mediaTags, eq(schema.mediaToTags.tagId, schema.mediaTags.id))
      .where(eq(schema.mediaToTags.mediaId, mediaId));
    return rows.map((r) => r.tag) as unknown as MediaTag[];
  }
  const store = memoryStore();
  const tags: MediaTag[] = [];
  for (const link of store.mediaToTags) {
    const [mid, tid] = link.split(':');
    if (mid === mediaId && tid) {
      const t = store.mediaTags.get(tid);
      if (t) tags.push(t);
    }
  }
  return tags;
}
