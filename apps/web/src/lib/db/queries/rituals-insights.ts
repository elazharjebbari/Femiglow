import { and, desc, eq, gte, sql as dsql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import type { RitualPhotoFacesStatus, RitualSource } from '@/lib/db/types';

/**
 * KPI étendus pour le dashboard insights.
 * Cf. docs/reviews-wall/execution/19-plan-action-ameliorations.md § P2.3
 */

export interface DailyCount {
  /** YYYY-MM-DD UTC. */
  date: string;
  submissions: number;
  approvals: number;
  rejections: number;
}

export interface VisionMlStats {
  totalPhotos: number;
  byStatus: Record<RitualPhotoFacesStatus, number>;
  /** Ratio REJECTED_FACE / totalPhotos. */
  rejectedFaceRate: number;
}

export interface SourceBreakdown {
  source: RitualSource;
  total: number;
  approved: number;
  rejected: number;
  /** Taux d'approbation = approved / (approved + rejected). */
  approvalRate: number;
}

export interface ExtendedInsights {
  daily: DailyCount[];
  visionMl: VisionMlStats;
  sources: SourceBreakdown[];
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Construit une liste de N derniers jours UTC, ordre chronologique. */
function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(toYmd(d));
  }
  return out;
}

export async function getExtendedInsights(
  windowDays: number = 30,
): Promise<ExtendedInsights> {
  const days = lastNDays(windowDays);
  const drizzle = db();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (windowDays - 1));

  if (drizzle) {
    const subs = (await drizzle
      .select({
        date: dsql<string>`to_char(${schema.ritualTestimonials.createdAt}::date, 'YYYY-MM-DD')`,
        count: dsql<number>`count(*)::int`,
      })
      .from(schema.ritualTestimonials)
      .where(gte(schema.ritualTestimonials.createdAt, since))
      .groupBy(dsql`${schema.ritualTestimonials.createdAt}::date`)
      .orderBy(desc(dsql`${schema.ritualTestimonials.createdAt}::date`))) as Array<{
      date: string;
      count: number;
    }>;

    const approves = (await drizzle
      .select({
        date: dsql<string>`to_char(${schema.ritualAuditLog.createdAt}::date, 'YYYY-MM-DD')`,
        count: dsql<number>`count(*)::int`,
      })
      .from(schema.ritualAuditLog)
      .where(
        and(
          eq(schema.ritualAuditLog.action, 'approved'),
          gte(schema.ritualAuditLog.createdAt, since),
        ),
      )
      .groupBy(dsql`${schema.ritualAuditLog.createdAt}::date`)) as Array<{
      date: string;
      count: number;
    }>;

    const rejects = (await drizzle
      .select({
        date: dsql<string>`to_char(${schema.ritualAuditLog.createdAt}::date, 'YYYY-MM-DD')`,
        count: dsql<number>`count(*)::int`,
      })
      .from(schema.ritualAuditLog)
      .where(
        and(
          eq(schema.ritualAuditLog.action, 'rejected'),
          gte(schema.ritualAuditLog.createdAt, since),
        ),
      )
      .groupBy(dsql`${schema.ritualAuditLog.createdAt}::date`)) as Array<{
      date: string;
      count: number;
    }>;

    const subsByDate = new Map(subs.map((r) => [r.date, r.count] as const));
    const apprByDate = new Map(approves.map((r) => [r.date, r.count] as const));
    const rejByDate = new Map(rejects.map((r) => [r.date, r.count] as const));

    const daily: DailyCount[] = days.map((date) => ({
      date,
      submissions: subsByDate.get(date) ?? 0,
      approvals: apprByDate.get(date) ?? 0,
      rejections: rejByDate.get(date) ?? 0,
    }));

    const photos = (await drizzle
      .select({
        status: schema.ritualTestimonialPhotos.facesStatus,
        count: dsql<number>`count(*)::int`,
      })
      .from(schema.ritualTestimonialPhotos)
      .groupBy(schema.ritualTestimonialPhotos.facesStatus)) as Array<{
      status: RitualPhotoFacesStatus;
      count: number;
    }>;

    const byStatus: Record<RitualPhotoFacesStatus, number> = {
      PENDING_CHECK: 0,
      OK: 0,
      MANUAL_REVIEW: 0,
      REJECTED_FACE: 0,
    };
    let totalPhotos = 0;
    for (const p of photos) {
      byStatus[p.status] = p.count;
      totalPhotos += p.count;
    }

    const sourceRows = (await drizzle
      .select({
        source: schema.ritualTestimonials.source,
        status: schema.ritualTestimonials.status,
        count: dsql<number>`count(*)::int`,
      })
      .from(schema.ritualTestimonials)
      .groupBy(schema.ritualTestimonials.source, schema.ritualTestimonials.status)) as Array<{
      source: RitualSource;
      status: string;
      count: number;
    }>;

    const sourcesAgg = new Map<RitualSource, SourceBreakdown>();
    for (const r of sourceRows) {
      const cur =
        sourcesAgg.get(r.source) ??
        ({
          source: r.source,
          total: 0,
          approved: 0,
          rejected: 0,
          approvalRate: 0,
        } satisfies SourceBreakdown);
      cur.total += r.count;
      if (r.status === 'APPROVED') cur.approved += r.count;
      if (r.status === 'REJECTED') cur.rejected += r.count;
      sourcesAgg.set(r.source, cur);
    }
    for (const s of sourcesAgg.values()) {
      const denom = s.approved + s.rejected;
      s.approvalRate = denom > 0 ? s.approved / denom : 0;
    }

    return {
      daily,
      visionMl: {
        totalPhotos,
        byStatus,
        rejectedFaceRate:
          totalPhotos > 0 ? byStatus.REJECTED_FACE / totalPhotos : 0,
      },
      sources: Array.from(sourcesAgg.values()).sort((a, b) => b.total - a.total),
    };
  }

  // Memory store
  const store = memoryStore();
  const allRituals = Array.from(store.ritualTestimonials.values());
  const allAudit = Array.from(store.ritualAuditLog.values());
  const allPhotos = Array.from(store.ritualTestimonialPhotos.values());

  const subsByDate = new Map<string, number>();
  for (const r of allRituals) {
    if (r.createdAt < since) continue;
    const d = toYmd(r.createdAt);
    subsByDate.set(d, (subsByDate.get(d) ?? 0) + 1);
  }
  const apprByDate = new Map<string, number>();
  const rejByDate = new Map<string, number>();
  for (const e of allAudit) {
    if (e.createdAt < since) continue;
    const d = toYmd(e.createdAt);
    if (e.action === 'approved') {
      apprByDate.set(d, (apprByDate.get(d) ?? 0) + 1);
    } else if (e.action === 'rejected') {
      rejByDate.set(d, (rejByDate.get(d) ?? 0) + 1);
    }
  }
  const daily: DailyCount[] = days.map((date) => ({
    date,
    submissions: subsByDate.get(date) ?? 0,
    approvals: apprByDate.get(date) ?? 0,
    rejections: rejByDate.get(date) ?? 0,
  }));

  const byStatus: Record<RitualPhotoFacesStatus, number> = {
    PENDING_CHECK: 0,
    OK: 0,
    MANUAL_REVIEW: 0,
    REJECTED_FACE: 0,
  };
  for (const p of allPhotos) byStatus[p.facesStatus] += 1;
  const totalPhotos = allPhotos.length;

  const sourcesAgg = new Map<RitualSource, SourceBreakdown>();
  for (const r of allRituals) {
    const cur =
      sourcesAgg.get(r.source) ??
      ({
        source: r.source,
        total: 0,
        approved: 0,
        rejected: 0,
        approvalRate: 0,
      } satisfies SourceBreakdown);
    cur.total += 1;
    if (r.status === 'APPROVED') cur.approved += 1;
    if (r.status === 'REJECTED') cur.rejected += 1;
    sourcesAgg.set(r.source, cur);
  }
  for (const s of sourcesAgg.values()) {
    const denom = s.approved + s.rejected;
    s.approvalRate = denom > 0 ? s.approved / denom : 0;
  }

  return {
    daily,
    visionMl: {
      totalPhotos,
      byStatus,
      rejectedFaceRate: totalPhotos > 0 ? byStatus.REJECTED_FACE / totalPhotos : 0,
    },
    sources: Array.from(sourcesAgg.values()).sort((a, b) => b.total - a.total),
  };
}
