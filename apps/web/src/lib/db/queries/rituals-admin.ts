import { and, desc, eq, inArray, sql as dsql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import type {
  RitualTestimonial,
  RitualTestimonialPhoto,
  RitualAuditEntry,
  RitualStatus,
} from '@/lib/db/types';
import { insertAuditEvent, refreshRitualAggregate } from './rituals';

/**
 * Queries admin (queue, détail, actions).
 * Cf. docs/reviews-wall/execution/06-admin-plan-action.md § 3-4
 */

export interface AdminListFilters {
  status?: RitualStatus | 'all';
  productKey?: string;
  withAutoFlags?: boolean;
  withFaceFlag?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AdminRitualRow extends RitualTestimonial {
  photos: RitualTestimonialPhoto[];
}

export interface AdminListResult {
  rows: AdminRitualRow[];
  total: number;
  page: number;
  pageSize: number;
  pendingCount: number;
}

export async function listAdminRituals(filters: AdminListFilters): Promise<AdminListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
  const drizzle = db();

  if (drizzle) {
    const conditions = [];
    if (filters.status && filters.status !== 'all') {
      conditions.push(eq(schema.ritualTestimonials.status, filters.status));
    }
    if (filters.productKey) {
      conditions.push(eq(schema.ritualTestimonials.productKey, filters.productKey));
    }
    if (filters.withAutoFlags) {
      conditions.push(dsql`jsonb_array_length(${schema.ritualTestimonials.autoFlags}) > 0`);
    }
    if (filters.withFaceFlag) {
      conditions.push(
        dsql`${schema.ritualTestimonials.autoFlags}::jsonb ? 'face_detected'`,
      );
    }

    const rows = (await drizzle
      .select()
      .from(schema.ritualTestimonials)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.ritualTestimonials.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)) as RitualTestimonial[];

    const ids = rows.map((r) => r.id);
    const photos =
      ids.length > 0
        ? ((await drizzle
            .select()
            .from(schema.ritualTestimonialPhotos)
            .where(inArray(schema.ritualTestimonialPhotos.testimonialId, ids))) as RitualTestimonialPhoto[])
        : [];

    const photosByT = new Map<string, RitualTestimonialPhoto[]>();
    for (const p of photos) {
      const arr = photosByT.get(p.testimonialId) ?? [];
      arr.push(p);
      photosByT.set(p.testimonialId, arr);
    }

    const totalRes = (await drizzle
      .select({ count: dsql<number>`count(*)::int` })
      .from(schema.ritualTestimonials)) as Array<{ count: number }>;
    const totalCount = totalRes[0]?.count ?? 0;

    const pendingRes = (await drizzle
      .select({ count: dsql<number>`count(*)::int` })
      .from(schema.ritualTestimonials)
      .where(eq(schema.ritualTestimonials.status, 'PENDING'))) as Array<{ count: number }>;
    const pendingCount = pendingRes[0]?.count ?? 0;

    return {
      rows: rows.map((r) => ({ ...r, photos: photosByT.get(r.id) ?? [] })),
      total: totalCount,
      page,
      pageSize,
      pendingCount,
    };
  }

  // Memory store
  const store = memoryStore();
  let all = Array.from(store.ritualTestimonials.values());
  if (filters.status && filters.status !== 'all') {
    all = all.filter((r) => r.status === filters.status);
  }
  if (filters.productKey) {
    all = all.filter((r) => r.productKey === filters.productKey);
  }
  if (filters.withAutoFlags) {
    all = all.filter((r) => r.autoFlags.length > 0);
  }
  if (filters.withFaceFlag) {
    all = all.filter((r) => r.autoFlags.includes('face_detected'));
  }
  all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const start = (page - 1) * pageSize;
  const slice = all.slice(start, start + pageSize);
  const photos = Array.from(store.ritualTestimonialPhotos.values());
  const rows = slice.map((r) => ({
    ...r,
    photos: photos.filter((p) => p.testimonialId === r.id),
  }));
  const pendingCount = Array.from(store.ritualTestimonials.values()).filter(
    (r) => r.status === 'PENDING',
  ).length;
  return { rows, total: all.length, page, pageSize, pendingCount };
}

export async function getAdminRitualById(id: string): Promise<AdminRitualRow | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = (await drizzle
      .select()
      .from(schema.ritualTestimonials)
      .where(eq(schema.ritualTestimonials.id, id))
      .limit(1)) as RitualTestimonial[];
    const row = rows[0];
    if (!row) return null;
    const photos = (await drizzle
      .select()
      .from(schema.ritualTestimonialPhotos)
      .where(eq(schema.ritualTestimonialPhotos.testimonialId, id))) as RitualTestimonialPhoto[];
    return { ...row, photos };
  }
  const row = memoryStore().ritualTestimonials.get(id);
  if (!row) return null;
  const photos = Array.from(memoryStore().ritualTestimonialPhotos.values()).filter(
    (p) => p.testimonialId === id,
  );
  return { ...row, photos };
}

export async function listAuditEntries(testimonialId: string): Promise<RitualAuditEntry[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = (await drizzle
      .select()
      .from(schema.ritualAuditLog)
      .where(eq(schema.ritualAuditLog.testimonialId, testimonialId))
      .orderBy(desc(schema.ritualAuditLog.createdAt))) as RitualAuditEntry[];
    return rows;
  }
  return Array.from(memoryStore().ritualAuditLog.values())
    .filter((e) => e.testimonialId === testimonialId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ---------------------------------------------------------------------------
// Actions admin (approve / reject / hide / restore / feature / correct)
// ---------------------------------------------------------------------------

export interface ActionContext {
  actorId: string;
}

export async function approveRitual(id: string, ctx: ActionContext): Promise<RitualTestimonial> {
  const row = await getAdminRitualById(id);
  if (!row) throw new Error('Not found');
  const drizzle = db();
  const now = new Date();
  const updated: RitualTestimonial = {
    ...row,
    status: 'APPROVED',
    publishedAt: row.publishedAt ?? now,
    updatedAt: now,
  };
  if (drizzle) {
    await drizzle
      .update(schema.ritualTestimonials)
      .set({
        status: 'APPROVED',
        publishedAt: updated.publishedAt,
        updatedAt: now,
      })
      .where(eq(schema.ritualTestimonials.id, id));
  } else {
    memoryStore().ritualTestimonials.set(id, updated);
  }
  await insertAuditEvent({
    testimonialId: id,
    actorId: ctx.actorId,
    action: 'approved',
  });
  await refreshRitualAggregate(row.productKey);
  return updated;
}

export async function rejectRitual(
  id: string,
  ctx: ActionContext,
  note: string,
): Promise<RitualTestimonial> {
  const row = await getAdminRitualById(id);
  if (!row) throw new Error('Not found');
  const drizzle = db();
  const now = new Date();
  const updated: RitualTestimonial = {
    ...row,
    status: 'REJECTED',
    moderationNote: note,
    updatedAt: now,
  };
  if (drizzle) {
    await drizzle
      .update(schema.ritualTestimonials)
      .set({ status: 'REJECTED', moderationNote: note, updatedAt: now })
      .where(eq(schema.ritualTestimonials.id, id));
  } else {
    memoryStore().ritualTestimonials.set(id, updated);
  }
  await insertAuditEvent({
    testimonialId: id,
    actorId: ctx.actorId,
    action: 'rejected',
    note,
  });
  return updated;
}

export async function hideRitual(
  id: string,
  ctx: ActionContext,
  note: string,
): Promise<RitualTestimonial> {
  const row = await getAdminRitualById(id);
  if (!row) throw new Error('Not found');
  const drizzle = db();
  const now = new Date();
  const updated: RitualTestimonial = {
    ...row,
    status: 'HIDDEN',
    moderationNote: note,
    updatedAt: now,
  };
  if (drizzle) {
    await drizzle
      .update(schema.ritualTestimonials)
      .set({ status: 'HIDDEN', moderationNote: note, updatedAt: now })
      .where(eq(schema.ritualTestimonials.id, id));
  } else {
    memoryStore().ritualTestimonials.set(id, updated);
  }
  await insertAuditEvent({
    testimonialId: id,
    actorId: ctx.actorId,
    action: 'hidden',
    note,
  });
  await refreshRitualAggregate(row.productKey);
  return updated;
}

export async function restoreRitual(
  id: string,
  ctx: ActionContext,
): Promise<RitualTestimonial> {
  const row = await getAdminRitualById(id);
  if (!row) throw new Error('Not found');
  const drizzle = db();
  const now = new Date();
  const updated: RitualTestimonial = {
    ...row,
    status: 'APPROVED',
    publishedAt: row.publishedAt ?? now,
    updatedAt: now,
  };
  if (drizzle) {
    await drizzle
      .update(schema.ritualTestimonials)
      .set({ status: 'APPROVED', publishedAt: updated.publishedAt, updatedAt: now })
      .where(eq(schema.ritualTestimonials.id, id));
  } else {
    memoryStore().ritualTestimonials.set(id, updated);
  }
  await insertAuditEvent({
    testimonialId: id,
    actorId: ctx.actorId,
    action: 'restored',
  });
  await refreshRitualAggregate(row.productKey);
  return updated;
}

export async function setFeatured(
  id: string,
  ctx: ActionContext,
  featured: boolean,
): Promise<{ ok: true; total_featured: number }> {
  const row = await getAdminRitualById(id);
  if (!row) throw new Error('Not found');
  const drizzle = db();

  if (featured) {
    // Limite : max 3 featured par product_key
    const existing = drizzle
      ? ((await drizzle
          .select()
          .from(schema.ritualTestimonials)
          .where(
            and(
              eq(schema.ritualTestimonials.featured, true),
              eq(schema.ritualTestimonials.productKey, row.productKey),
            ),
          )) as RitualTestimonial[])
      : Array.from(memoryStore().ritualTestimonials.values()).filter(
          (r) => r.featured && r.productKey === row.productKey,
        );
    if (existing.length >= 3 && !existing.some((e) => e.id === id)) {
      throw new Error('FEATURED_LIMIT_REACHED');
    }
  }

  const now = new Date();
  if (drizzle) {
    await drizzle
      .update(schema.ritualTestimonials)
      .set({ featured, updatedAt: now })
      .where(eq(schema.ritualTestimonials.id, id));
  } else {
    memoryStore().ritualTestimonials.set(id, { ...row, featured, updatedAt: now });
  }
  await insertAuditEvent({
    testimonialId: id,
    actorId: ctx.actorId,
    action: featured ? 'featured_on' : 'featured_off',
  });

  const total = drizzle
    ? ((await drizzle
        .select({ count: dsql<number>`count(*)::int` })
        .from(schema.ritualTestimonials)
        .where(
          and(
            eq(schema.ritualTestimonials.featured, true),
            eq(schema.ritualTestimonials.productKey, row.productKey),
          ),
        )) as Array<{ count: number }>)[0]?.count ?? 0
    : Array.from(memoryStore().ritualTestimonials.values()).filter(
        (r) => r.featured && r.productKey === row.productKey,
      ).length;

  return { ok: true, total_featured: total };
}
