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
  /** Placeholder `data:` (colonne `blur_data_url`), cf. `lib/media/pipeline/blur-data-url.ts`. */
  blurDataUrl?: string | null;
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

/**
 * Plusieurs médias en une requête (supprimés inclus — l'appelant décide).
 * Utilisé par l'admin « médias par audience » pour signaler les cellules
 * dont une image a été supprimée ou n'est pas prête.
 */
export async function findMediaByIds(ids: readonly string[]): Promise<Media[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.select().from(schema.media).where(inArray(schema.media.id, unique));
    return rows.map((r) => rowToMedia(r as Record<string, unknown>));
  }
  const store = memoryStore();
  return unique.map((id) => store.media.get(id)).filter((m): m is Media => !!m);
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

/**
 * Média image (non supprimé) dont la source ingérée a cette empreinte
 * (`overrides.sourceChecksum`, posée par `lib/media/ingest.ts`). Sert au
 * dédoublonnage de l'import : deux fichiers identiques octet pour octet
 * partagent le même média. Le plus ancien gagne (ordre stable).
 */
export async function findMediaBySourceChecksum(checksum: string): Promise<Media | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.media)
      .where(
        and(
          dsql`${schema.media.overrides}->>'sourceChecksum' = ${checksum}`,
          eq(schema.media.kind, 'image'),
          isNull(schema.media.deletedAt),
        ),
      )
      .orderBy(asc(schema.media.createdAt), asc(schema.media.id))
      .limit(1);
    const r = rows[0];
    return r ? rowToMedia(r as Record<string, unknown>) : null;
  }
  const matches = Array.from(memoryStore().media.values())
    .filter(
      (m) =>
        m.kind === 'image' &&
        m.deletedAt === null &&
        m.overrides?.sourceChecksum === checksum,
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  return matches[0] ?? null;
}

/**
 * Page de médias image exploitables (`ready` / `passthrough`, non
 * supprimés) sans placeholder `blur_data_url`, triés par id (pagination
 * par curseur `afterId`, stable même si des lignes sont mises à jour
 * entre deux pages). Utilisé par `scripts/backfill-media-blur.ts`.
 */
export async function listImageMediaWithoutBlur(
  opts: { afterId?: string | null; limit?: number } = {},
): Promise<Media[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 1000);
  const drizzle = db();
  if (drizzle) {
    const conditions = [
      eq(schema.media.kind, 'image'),
      isNull(schema.media.deletedAt),
      isNull(schema.media.blurDataUrl),
      inArray(schema.media.status, ['ready', 'passthrough']),
    ];
    if (opts.afterId) conditions.push(dsql`${schema.media.id} > ${opts.afterId}`);
    const rows = await drizzle
      .select()
      .from(schema.media)
      .where(and(...conditions))
      .orderBy(asc(schema.media.id))
      .limit(limit);
    return rows.map((r) => rowToMedia(r as Record<string, unknown>));
  }
  return Array.from(memoryStore().media.values())
    .filter(
      (m) =>
        m.kind === 'image' &&
        m.deletedAt === null &&
        !m.blurDataUrl &&
        (m.status === 'ready' || m.status === 'passthrough') &&
        (!opts.afterId || m.id > opts.afterId),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, limit);
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

/**
 * Levée quand un média encore référencé par un ensemble de médias par
 * audience (`component_media_set_items`) est supprimé définitivement.
 * En Postgres, c'est la FK `ON DELETE RESTRICT` qui refuse (code 23503) ;
 * le mode mémoire reproduit la même règle avec cette erreur.
 */
export class MediaInUseError extends Error {
  code = 'media_in_use';
  constructor(public mediaId: string) {
    super(`Media ${mediaId} is referenced by a component media set`);
  }
}

/**
 * Vrai si `err` (postgres-js, PGlite ou enveloppe Drizzle via `cause`) est
 * une violation de FK (23503) due à `component_media_set_items`. Sans nom
 * de contrainte exploitable, tout 23503 sur `media` est traité comme tel.
 */
function isMediaSetItemsFkViolation(err: unknown): boolean {
  let cur: unknown = err;
  for (let depth = 0; depth < 4 && cur && typeof cur === 'object'; depth += 1) {
    const e = cur as { code?: unknown; constraint_name?: unknown; constraint?: unknown; table_name?: unknown; table?: unknown };
    if (e.code === '23503') {
      const name = e.constraint_name ?? e.constraint;
      const table = e.table_name ?? e.table;
      if (typeof name === 'string') return name.startsWith('component_media_set_items_');
      if (typeof table === 'string') return table === 'component_media_set_items';
      return true;
    }
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

export async function hardDeleteMedia(id: string): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    try {
      await drizzle.delete(schema.media).where(eq(schema.media.id, id));
    } catch (err) {
      // FK `ON DELETE RESTRICT` (component_media_set_items) → même erreur
      // métier qu'en mémoire (parité, → 409 côté route).
      if (isMediaSetItemsFkViolation(err)) throw new MediaInUseError(id);
      throw err;
    }
    return;
  }
  const store = memoryStore();
  // Équivalent mémoire de la FK `ON DELETE RESTRICT` (component_media_set_items).
  for (const item of store.componentMediaSetItems.values()) {
    if (item.mediaId === id || item.mobileMediaId === id) {
      throw new MediaInUseError(id);
    }
  }
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
