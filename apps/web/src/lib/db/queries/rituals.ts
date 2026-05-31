import { and, desc, eq, inArray, sql as dsql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type {
  RitualTestimonial,
  RitualTestimonialPhoto,
  RitualAuditEntry,
  RitualAggregateRow,
  RitualStatus,
  RitualSignal,
} from '@/lib/db/types';
import type {
  RitualSummary,
  RitualListQuery,
  RitualTestimonialPublic,
  RitualPhotoPublic,
} from '@/lib/schemas/rituals';

/**
 * Queries Drizzle + memory store pour le composant Rituels partagés.
 * Pattern dual-driver : si DATABASE_URL configuré → Drizzle. Sinon → in-memory.
 * Cf. docs/reviews-wall/execution/04-backend-plan-action.md § 4.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generatePublicSlug(): string {
  // 8 caractères base32-like depuis createId
  return createId().slice(0, 8);
}

interface CursorPayload {
  publishedAt: string; // ISO
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    if (typeof parsed.publishedAt === 'string' && typeof parsed.id === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function toPublicTestimonial(
  row: RitualTestimonial,
  photos: RitualTestimonialPhoto[],
): RitualTestimonialPublic {
  const cityFallback = row.isAnonymous && !row.authorFirstName ? row.authorCity : row.authorCity;
  return {
    publicSlug: row.publicSlug,
    body: row.body,
    wouldRecommend: row.wouldRecommend,
    ritualTags: (row.ritualTags ?? []) as RitualTestimonialPublic['ritualTags'],
    signature: {
      firstName: row.isAnonymous ? null : row.authorFirstName,
      city: cityFallback,
      initiatedSince: row.initiatedSince,
      isAnonymous: row.isAnonymous,
      verifiedPurchase: row.verifiedPurchase,
    },
    language: row.language,
    photos: photos
      .filter((p) => p.facesStatus === 'OK')
      .sort((a, b) => a.position - b.position)
      .map(toPublicPhoto),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

function toPublicPhoto(p: RitualTestimonialPhoto): RitualPhotoPublic {
  return {
    url: p.url,
    thumbUrl: p.thumbUrl,
    width: p.width,
    height: p.height,
    focalX: Number(p.focalX),
    focalY: Number(p.focalY),
    position: p.position,
    alt: p.alt,
  };
}

// ---------------------------------------------------------------------------
// Insertion
// ---------------------------------------------------------------------------

export async function insertRitual(input: {
  productKey: string;
  body: string;
  bodyOriginal?: string | null;
  wouldRecommend: RitualSignal;
  ritualTags?: string[];
  authorFirstName?: string | null;
  authorCity?: string | null;
  initiatedSince?: string | null;
  isAnonymous?: boolean;
  language?: 'fr' | 'ar' | 'en';
  source: RitualTestimonial['source'];
  customerHash?: string | null;
  orderId?: string | null;
  verifiedPurchase?: boolean;
  status?: RitualStatus;
  autoFlags?: string[];
  featured?: boolean;
  publishedAt?: Date | null;
  importBatchId?: string | null;
  importRowId?: string | null;
}): Promise<RitualTestimonial> {
  const now = new Date();
  const status: RitualStatus = input.status ?? 'PENDING';
  const ritual: RitualTestimonial = {
    id: createId('rt'),
    publicSlug: generatePublicSlug(),
    productKey: input.productKey,
    body: input.body,
    bodyOriginal: input.bodyOriginal ?? null,
    wouldRecommend: input.wouldRecommend,
    ritualTags: input.ritualTags ?? [],
    authorFirstName: input.authorFirstName ?? null,
    authorCity: input.authorCity ?? null,
    initiatedSince: input.initiatedSince ?? null,
    isAnonymous: input.isAnonymous ?? false,
    language: input.language ?? 'fr',
    status,
    source: input.source,
    customerHash: input.customerHash ?? null,
    orderId: input.orderId ?? null,
    verifiedPurchase: input.verifiedPurchase ?? false,
    featured: input.featured ?? false,
    moderationNote: null,
    autoFlags: input.autoFlags ?? [],
    importBatchId: input.importBatchId ?? null,
    importRowId: input.importRowId ?? null,
    createdAt: now,
    publishedAt: status === 'APPROVED' ? (input.publishedAt ?? now) : input.publishedAt ?? null,
    updatedAt: now,
  };

  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.ritualTestimonials).values(ritual);
  } else {
    memoryStore().ritualTestimonials.set(ritual.id, ritual);
  }
  return ritual;
}

export async function insertPhoto(input: {
  testimonialId: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  byteSize: number;
  mime: string;
  alt?: string | null;
  position?: number;
  facesStatus?: RitualTestimonialPhoto['facesStatus'];
  facesCount?: number;
}): Promise<RitualTestimonialPhoto> {
  const photo: RitualTestimonialPhoto = {
    id: createId('rp'),
    testimonialId: input.testimonialId,
    url: input.url,
    thumbUrl: input.thumbUrl,
    focalX: '0.500',
    focalY: '0.500',
    width: input.width,
    height: input.height,
    byteSize: input.byteSize,
    mime: input.mime,
    alt: input.alt ?? null,
    facesStatus: input.facesStatus ?? 'PENDING_CHECK',
    facesCount: input.facesCount ?? 0,
    facesCheckAt: input.facesStatus && input.facesStatus !== 'PENDING_CHECK' ? new Date() : null,
    position: input.position ?? 0,
    createdAt: new Date(),
  };

  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.ritualTestimonialPhotos).values(photo);
  } else {
    memoryStore().ritualTestimonialPhotos.set(photo.id, photo);
  }
  return photo;
}

export async function insertAuditEvent(input: {
  testimonialId: string | null;
  actorId: string | null;
  action: string;
  note?: string | null;
  payload?: Record<string, unknown>;
}): Promise<RitualAuditEntry> {
  const base = {
    id: createId('ral'),
    testimonialId: input.testimonialId,
    actorId: input.actorId,
    action: input.action,
    note: input.note ?? null,
    payload: input.payload ?? {},
    createdAt: new Date(),
  };

  // Lecture de la dernière entrée pour chaîner la signature.
  const previous = await getLastAuditEntry();
  const { signWithPrevious } = await import('@/lib/rituals/audit-signing');
  const { previousHash, signature } = signWithPrevious(base, previous);

  const entry: RitualAuditEntry = { ...base, previousHash, signature };

  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.ritualAuditLog).values(entry);
  } else {
    memoryStore().ritualAuditLog.set(entry.id, entry);
  }
  return entry;
}

async function getLastAuditEntry(): Promise<RitualAuditEntry | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = (await drizzle
      .select()
      .from(schema.ritualAuditLog)
      .orderBy(desc(schema.ritualAuditLog.createdAt))
      .limit(1)) as RitualAuditEntry[];
    return rows[0] ?? null;
  }
  const all = Array.from(memoryStore().ritualAuditLog.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return all[0] ?? null;
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function getRitualSummary(productKey: string): Promise<RitualSummary> {
  const drizzle = db();
  let aggregate: RitualAggregateRow | undefined;

  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.ritualAggregate)
      .where(eq(schema.ritualAggregate.productKey, productKey))
      .limit(1);
    aggregate = rows[0] as RitualAggregateRow | undefined;
  } else {
    aggregate = memoryStore().ritualAggregate.get(productKey);
  }

  if (!aggregate) {
    return {
      productKey,
      totalCount: 0,
      ouiCount: 0,
      hesiteCount: 0,
      nonCount: 0,
      withPhotosCount: 0,
      topTags: [],
      lastPublishedAt: null,
    };
  }

  return {
    productKey,
    totalCount: aggregate.totalCount,
    ouiCount: aggregate.ouiCount,
    hesiteCount: aggregate.hesiteCount,
    nonCount: aggregate.nonCount,
    withPhotosCount: aggregate.withPhotosCount,
    topTags: (aggregate.topTags ?? []) as RitualSummary['topTags'],
    lastPublishedAt: aggregate.lastPublishedAt
      ? aggregate.lastPublishedAt.toISOString()
      : null,
  };
}

export interface RitualListResult {
  items: RitualTestimonialPublic[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export async function listRituals(query: RitualListQuery): Promise<RitualListResult> {
  const limit = query.limit;
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  const drizzle = db();

  if (drizzle) {
    // Conditions communes (hors langue + curseur), partagées par la sonde de
    // repli langue et la requête principale.
    const baseConditions = [
      eq(schema.ritualTestimonials.productKey, query.productKey),
      eq(schema.ritualTestimonials.status, 'APPROVED'),
    ];
    if (query.featured) {
      baseConditions.push(eq(schema.ritualTestimonials.featured, true));
    }
    if (query.signal) {
      baseConditions.push(eq(schema.ritualTestimonials.wouldRecommend, query.signal));
    }
    if (query.withPhotos) {
      baseConditions.push(
        dsql`EXISTS (SELECT 1 FROM ${schema.ritualTestimonialPhotos} p WHERE p.testimonial_id = ${schema.ritualTestimonials.id} AND p.faces_status = 'OK')`,
      );
    }
    if (query.tags && query.tags.length > 0) {
      baseConditions.push(
        dsql`(${schema.ritualTestimonials.ritualTags})::jsonb ?| ${query.tags}::text[]`,
      );
    }

    const conditions = [...baseConditions];
    // Phase 7E-11 — filtre langue avec repli FR. Si la locale demandée n'a aucun
    // témoignage (mêmes filtres), on retombe sur FR pour ne jamais vider le module.
    if (query.language) {
      let effectiveLanguage: RitualTestimonial['language'] = query.language;
      if (query.language !== 'fr') {
        const probe = (await drizzle
          .select({ id: schema.ritualTestimonials.id })
          .from(schema.ritualTestimonials)
          .where(and(...baseConditions, eq(schema.ritualTestimonials.language, query.language)))
          .limit(1)) as Array<{ id: string }>;
        if (probe.length === 0) effectiveLanguage = 'fr';
      }
      conditions.push(eq(schema.ritualTestimonials.language, effectiveLanguage));
    }
    if (cursor) {
      conditions.push(
        dsql`(${schema.ritualTestimonials.publishedAt}, ${schema.ritualTestimonials.id}) < (${cursor.publishedAt}::timestamptz, ${cursor.id})`,
      );
    }

    const rows = (await drizzle
      .select()
      .from(schema.ritualTestimonials)
      .where(and(...conditions))
      .orderBy(
        desc(schema.ritualTestimonials.publishedAt),
        desc(schema.ritualTestimonials.id),
      )
      .limit(limit + 1)) as RitualTestimonial[];

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const ids = items.map((i) => i.id);
    const photosRows =
      ids.length > 0
        ? ((await drizzle
            .select()
            .from(schema.ritualTestimonialPhotos)
            .where(inArray(schema.ritualTestimonialPhotos.testimonialId, ids))) as RitualTestimonialPhoto[])
        : [];

    const photosByTestimonial = new Map<string, RitualTestimonialPhoto[]>();
    for (const p of photosRows) {
      const arr = photosByTestimonial.get(p.testimonialId) ?? [];
      arr.push(p);
      photosByTestimonial.set(p.testimonialId, arr);
    }

    return {
      items: items.map((r) => toPublicTestimonial(r, photosByTestimonial.get(r.id) ?? [])),
      nextCursor:
        hasMore && items.length > 0 && items[items.length - 1]?.publishedAt
          ? encodeCursor({
              publishedAt: items[items.length - 1]!.publishedAt!.toISOString(),
              id: items[items.length - 1]!.id,
            })
          : null,
      hasMore,
      total: 0, // total exact non calculé (perf) ; voir aggregate pour le grand total
    };
  }

  // Memory store branch
  const store = memoryStore();
  let rows = Array.from(store.ritualTestimonials.values())
    .filter(
      (r) =>
        r.productKey === query.productKey &&
        r.status === 'APPROVED' &&
        (!query.featured || r.featured) &&
        (!query.signal || r.wouldRecommend === query.signal),
    )
    .filter((r) => {
      if (!query.withPhotos) return true;
      const photos = Array.from(store.ritualTestimonialPhotos.values()).filter(
        (p) => p.testimonialId === r.id && p.facesStatus === 'OK',
      );
      return photos.length > 0;
    })
    .filter((r) => {
      if (!query.tags || query.tags.length === 0) return true;
      return query.tags.some((t) => r.ritualTags.includes(t));
    });

  // Phase 7E-11 — filtre langue avec repli FR (miroir de la branche Drizzle).
  // Si la locale demandée n'a aucun témoignage (mêmes filtres), on retombe sur
  // FR (`language === 'fr'` ou langue absente) pour ne jamais vider le module.
  if (query.language) {
    const isFr = (r: RitualTestimonial) => r.language === 'fr' || r.language == null;
    const inRequested = rows.filter((r) => r.language === query.language);
    const effective =
      query.language === 'fr' || inRequested.length > 0
        ? rows.filter((r) =>
            query.language === 'fr' ? isFr(r) : r.language === query.language,
          )
        : rows.filter(isFr);
    rows = effective;
  }

  rows.sort((a, b) => {
    const ta = a.publishedAt?.getTime() ?? 0;
    const tb = b.publishedAt?.getTime() ?? 0;
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });

  if (cursor) {
    const idx = rows.findIndex((r) => r.id === cursor.id);
    if (idx >= 0) rows = rows.slice(idx + 1);
  }

  const slice = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const total = rows.length;

  const items: RitualTestimonialPublic[] = slice.map((r) => {
    const photos = Array.from(store.ritualTestimonialPhotos.values()).filter(
      (p) => p.testimonialId === r.id,
    );
    return toPublicTestimonial(r, photos);
  });

  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last?.publishedAt
      ? encodeCursor({ publishedAt: last.publishedAt.toISOString(), id: last.id })
      : null;

  return { items, nextCursor, hasMore, total };
}

export async function getRitualByPublicSlug(
  slug: string,
): Promise<RitualTestimonialPublic | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = (await drizzle
      .select()
      .from(schema.ritualTestimonials)
      .where(eq(schema.ritualTestimonials.publicSlug, slug))
      .limit(1)) as RitualTestimonial[];
    const row = rows[0];
    if (!row || row.status !== 'APPROVED') return null;
    const photos = (await drizzle
      .select()
      .from(schema.ritualTestimonialPhotos)
      .where(eq(schema.ritualTestimonialPhotos.testimonialId, row.id))) as RitualTestimonialPhoto[];
    return toPublicTestimonial(row, photos);
  }
  const store = memoryStore();
  const row = Array.from(store.ritualTestimonials.values()).find((r) => r.publicSlug === slug);
  if (!row || row.status !== 'APPROVED') return null;
  const photos = Array.from(store.ritualTestimonialPhotos.values()).filter(
    (p) => p.testimonialId === row.id,
  );
  return toPublicTestimonial(row, photos);
}

// ---------------------------------------------------------------------------
// Agrégation (refresh)
// ---------------------------------------------------------------------------

export async function refreshRitualAggregate(productKey: string): Promise<RitualAggregateRow> {
  const drizzle = db();
  let approved: RitualTestimonial[];
  let photos: RitualTestimonialPhoto[];

  if (drizzle) {
    approved = (await drizzle
      .select()
      .from(schema.ritualTestimonials)
      .where(
        and(
          eq(schema.ritualTestimonials.productKey, productKey),
          eq(schema.ritualTestimonials.status, 'APPROVED'),
        ),
      )) as RitualTestimonial[];
    const ids = approved.map((r) => r.id);
    photos =
      ids.length > 0
        ? ((await drizzle
            .select()
            .from(schema.ritualTestimonialPhotos)
            .where(inArray(schema.ritualTestimonialPhotos.testimonialId, ids))) as RitualTestimonialPhoto[])
        : [];
  } else {
    const store = memoryStore();
    approved = Array.from(store.ritualTestimonials.values()).filter(
      (r) => r.productKey === productKey && r.status === 'APPROVED',
    );
    photos = Array.from(store.ritualTestimonialPhotos.values()).filter((p) =>
      approved.some((r) => r.id === p.testimonialId),
    );
  }

  const ouiCount = approved.filter((r) => r.wouldRecommend === 'oui').length;
  const hesiteCount = approved.filter((r) => r.wouldRecommend === 'hesite').length;
  const nonCount = approved.filter((r) => r.wouldRecommend === 'non').length;
  const withPhotosCount = approved.filter((r) =>
    photos.some((p) => p.testimonialId === r.id && p.facesStatus === 'OK'),
  ).length;

  const tagCounts = new Map<string, number>();
  for (const r of approved) {
    for (const tag of r.ritualTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, count]) => ({ tag, count }));

  const lastPublishedAt = approved
    .filter((r) => r.publishedAt)
    .reduce<Date | null>((acc, r) => {
      const d = r.publishedAt!;
      return !acc || d > acc ? d : acc;
    }, null);

  const aggregate: RitualAggregateRow = {
    productKey,
    totalCount: approved.length,
    ouiCount,
    hesiteCount,
    nonCount,
    withPhotosCount,
    topTags,
    lastPublishedAt,
    refreshedAt: new Date(),
  };

  if (drizzle) {
    await drizzle
      .insert(schema.ritualAggregate)
      .values(aggregate)
      .onConflictDoUpdate({
        target: schema.ritualAggregate.productKey,
        set: {
          totalCount: aggregate.totalCount,
          ouiCount: aggregate.ouiCount,
          hesiteCount: aggregate.hesiteCount,
          nonCount: aggregate.nonCount,
          withPhotosCount: aggregate.withPhotosCount,
          topTags: aggregate.topTags,
          lastPublishedAt: aggregate.lastPublishedAt,
          refreshedAt: aggregate.refreshedAt,
        },
      });
  } else {
    memoryStore().ritualAggregate.set(productKey, aggregate);
  }
  return aggregate;
}
