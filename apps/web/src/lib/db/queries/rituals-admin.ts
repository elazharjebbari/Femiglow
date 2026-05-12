import { and, asc, desc, eq, gt, gte, ilike, inArray, lt, lte, or, sql as dsql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import type {
  RitualTestimonial,
  RitualTestimonialPhoto,
  RitualAuditEntry,
  RitualStatus,
} from '@/lib/db/types';
import { insertAuditEvent, refreshRitualAggregate } from './rituals';
import { dispatchRitualEvent } from '@/lib/rituals/webhook-dispatcher';

/**
 * Queries admin (queue, détail, actions).
 * Cf. docs/reviews-wall/execution/06-admin-plan-action.md § 3-4
 */

export interface AdminListFilters {
  status?: RitualStatus | RitualStatus[] | 'all';
  productKey?: string;
  withAutoFlags?: boolean;
  withFaceFlag?: boolean;
  /** Auto-flags requis (intersection si plusieurs). */
  flags?: string[];
  /** Sources autorisées (union). */
  sources?: import('@/lib/db/types').RitualSource[];
  /** ISO `YYYY-MM-DD` (inclus). */
  dateFrom?: string | null;
  /** ISO `YYYY-MM-DD` (inclus, jusqu'à 23:59:59). */
  dateTo?: string | null;
  /** Recherche libre sur prénom auteur ou customerHash. */
  authorQuery?: string | null;
  /** Recherche full-text body / body_original / author_first_name / author_city. */
  search?: string | null;
  verified?: boolean | null;
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
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      conditions.push(inArray(schema.ritualTestimonials.status, statuses));
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
    if (filters.flags && filters.flags.length > 0) {
      // intersection : tous les flags doivent être présents
      for (const f of filters.flags) {
        conditions.push(
          dsql`${schema.ritualTestimonials.autoFlags}::jsonb ? ${f}`,
        );
      }
    }
    if (filters.sources && filters.sources.length > 0) {
      conditions.push(inArray(schema.ritualTestimonials.source, filters.sources));
    }
    if (filters.dateFrom) {
      conditions.push(
        gte(schema.ritualTestimonials.createdAt, new Date(`${filters.dateFrom}T00:00:00Z`)),
      );
    }
    if (filters.dateTo) {
      conditions.push(
        lte(schema.ritualTestimonials.createdAt, new Date(`${filters.dateTo}T23:59:59Z`)),
      );
    }
    if (filters.authorQuery) {
      const pat = `%${filters.authorQuery.replace(/[%_]/g, '\\$&')}%`;
      conditions.push(
        or(
          ilike(schema.ritualTestimonials.authorFirstName, pat),
          ilike(schema.ritualTestimonials.customerHash, pat),
        ) ?? dsql`true`,
      );
    }
    if (filters.verified === true) {
      conditions.push(eq(schema.ritualTestimonials.verifiedPurchase, true));
    } else if (filters.verified === false) {
      conditions.push(eq(schema.ritualTestimonials.verifiedPurchase, false));
    }
    if (filters.search) {
      const pat = `%${filters.search.replace(/[%_]/g, '\\$&')}%`;
      const cond = or(
        ilike(schema.ritualTestimonials.body, pat),
        ilike(schema.ritualTestimonials.bodyOriginal, pat),
        ilike(schema.ritualTestimonials.authorFirstName, pat),
        ilike(schema.ritualTestimonials.authorCity, pat),
      );
      if (cond) conditions.push(cond);
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
      .from(schema.ritualTestimonials)
      .where(conditions.length ? and(...conditions) : undefined)) as Array<{ count: number }>;
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
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    all = all.filter((r) => statuses.includes(r.status));
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
  if (filters.flags && filters.flags.length > 0) {
    const required = filters.flags;
    all = all.filter((r) => required.every((f) => r.autoFlags.includes(f)));
  }
  if (filters.sources && filters.sources.length > 0) {
    const sources = filters.sources;
    all = all.filter((r) => sources.includes(r.source));
  }
  if (filters.dateFrom) {
    const from = new Date(`${filters.dateFrom}T00:00:00Z`);
    all = all.filter((r) => r.createdAt >= from);
  }
  if (filters.dateTo) {
    const to = new Date(`${filters.dateTo}T23:59:59Z`);
    all = all.filter((r) => r.createdAt <= to);
  }
  if (filters.authorQuery) {
    const q = filters.authorQuery.toLowerCase();
    all = all.filter(
      (r) =>
        (r.authorFirstName ?? '').toLowerCase().includes(q) ||
        (r.customerHash ?? '').toLowerCase().includes(q),
    );
  }
  if (filters.verified === true) {
    all = all.filter((r) => r.verifiedPurchase === true);
  } else if (filters.verified === false) {
    all = all.filter((r) => r.verifiedPurchase === false);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    all = all.filter(
      (r) =>
        r.body.toLowerCase().includes(q) ||
        (r.bodyOriginal ?? '').toLowerCase().includes(q) ||
        (r.authorFirstName ?? '').toLowerCase().includes(q) ||
        (r.authorCity ?? '').toLowerCase().includes(q),
    );
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

export interface NeighborsResult {
  previousId: string | null;
  nextId: string | null;
  position: number;
  total: number;
}

/**
 * Renvoie les IDs précédent / suivant d'un rituel dans la même « file »
 * (status identique), ordonnée par createdAt desc. Si statuses contient
 * plusieurs valeurs, la file est l'union triée.
 *
 * `previous` = créé après le rituel courant (apparait au-dessus dans la liste).
 * `next` = créé avant (apparait en-dessous).
 */
export async function getRitualNeighbors(
  id: string,
  statuses: RitualStatus[],
): Promise<NeighborsResult> {
  if (statuses.length === 0) {
    return { previousId: null, nextId: null, position: 0, total: 0 };
  }
  const drizzle = db();
  if (drizzle) {
    const cur = (await drizzle
      .select()
      .from(schema.ritualTestimonials)
      .where(eq(schema.ritualTestimonials.id, id))
      .limit(1)) as RitualTestimonial[];
    const row = cur[0];
    if (!row) return { previousId: null, nextId: null, position: 0, total: 0 };

    const statusCond = inArray(schema.ritualTestimonials.status, statuses);

    const prev = (await drizzle
      .select({ id: schema.ritualTestimonials.id })
      .from(schema.ritualTestimonials)
      .where(and(statusCond, gt(schema.ritualTestimonials.createdAt, row.createdAt)))
      .orderBy(asc(schema.ritualTestimonials.createdAt))
      .limit(1)) as Array<{ id: string }>;

    const next = (await drizzle
      .select({ id: schema.ritualTestimonials.id })
      .from(schema.ritualTestimonials)
      .where(and(statusCond, lt(schema.ritualTestimonials.createdAt, row.createdAt)))
      .orderBy(desc(schema.ritualTestimonials.createdAt))
      .limit(1)) as Array<{ id: string }>;

    const totalRes = (await drizzle
      .select({ count: dsql<number>`count(*)::int` })
      .from(schema.ritualTestimonials)
      .where(statusCond)) as Array<{ count: number }>;
    const total = totalRes[0]?.count ?? 0;

    const positionRes = (await drizzle
      .select({ count: dsql<number>`count(*)::int` })
      .from(schema.ritualTestimonials)
      .where(
        and(statusCond, gt(schema.ritualTestimonials.createdAt, row.createdAt)),
      )) as Array<{ count: number }>;
    const position = (positionRes[0]?.count ?? 0) + 1;

    return {
      previousId: prev[0]?.id ?? null,
      nextId: next[0]?.id ?? null,
      position,
      total,
    };
  }

  // Memory store
  const store = memoryStore();
  const row = store.ritualTestimonials.get(id);
  if (!row) return { previousId: null, nextId: null, position: 0, total: 0 };
  const same = Array.from(store.ritualTestimonials.values())
    .filter((r) => statuses.includes(r.status))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const idx = same.findIndex((r) => r.id === id);
  if (idx === -1) {
    return { previousId: null, nextId: null, position: 0, total: same.length };
  }
  return {
    previousId: idx > 0 ? (same[idx - 1]?.id ?? null) : null,
    nextId: idx < same.length - 1 ? (same[idx + 1]?.id ?? null) : null,
    position: idx + 1,
    total: same.length,
  };
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
  dispatchRitualEvent('ritual.approved', updated).catch((e) =>
    console.error('[rituals-admin] webhook dispatch failed', e),
  );
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
  dispatchRitualEvent('ritual.rejected', updated, { note }).catch((e) =>
    console.error('[rituals-admin] webhook dispatch failed', e),
  );
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
  dispatchRitualEvent('ritual.hidden', updated, { note }).catch((e) =>
    console.error('[rituals-admin] webhook dispatch failed', e),
  );
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
  dispatchRitualEvent('ritual.restored', updated).catch((e) =>
    console.error('[rituals-admin] webhook dispatch failed', e),
  );
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
  dispatchRitualEvent(
    featured ? 'ritual.featured_on' : 'ritual.featured_off',
    { ...row, featured, updatedAt: now },
  ).catch((e) => console.error('[rituals-admin] webhook dispatch failed', e));

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
