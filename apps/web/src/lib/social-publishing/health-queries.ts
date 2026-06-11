/**
 * Helpers query pour le dashboard /admin/content-studio/health.
 *
 * Référence : `docs/live-systems-fix-2026-05/07-system-publishing.md` § S5
 *
 * Source de données : tables `content_post` (status workflow) + Drizzle
 * agg. Pour les stats d'attempt/erreur, joindre avec
 * `content_postiz_delivery` (existant) si besoin de granularité.
 *
 * Toutes les fonctions retournent des structures sérialisables (numbers,
 * strings, ISO dates) pour pouvoir être consommées par un Server Component.
 */
import 'server-only';
import { and, count, eq, gte, sql, desc } from 'drizzle-orm';
import { db, memoryStore } from '@/lib/db/client';
import { contentPosts } from '@/lib/db/schema-content-studio';

export interface JobsCounter {
  status: string;
  count: number;
}

export interface PublishingHealthStats {
  /** Snapshot ts ISO. */
  asOf: string;
  /** Counts par status pour la fenêtre lookback. */
  byStatus: JobsCounter[];
  /** Jobs in flight (status='processing' ou 'scheduled' + scheduledAt < now). */
  inFlight: number;
  /** Dead letters (status='dead' dans lookback). */
  deadLetters: number;
  /** Pourcentage de succès sur la fenêtre. */
  successRatePct: number;
  /** Latence P95 ms (durée entre createdAt et publishedAt). */
  latencyP95Ms: number | null;
  /** Total jobs traités dans la fenêtre. */
  totalJobs: number;
}

const DEFAULT_LOOKBACK_HOURS = 24;

export async function getPublishingHealthStats(
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
): Promise<PublishingHealthStats> {
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const drizzle = db();

  if (drizzle) {
    return getDrizzleStats(drizzle, since);
  }
  return getMemoryStats(since);
}

async function getDrizzleStats(
  drizzle: NonNullable<ReturnType<typeof db>>,
  since: Date,
): Promise<PublishingHealthStats> {
  const byStatus = await drizzle
    .select({
      status: contentPosts.status,
      count: count(),
    })
    .from(contentPosts)
    .where(gte(contentPosts.createdAt, since))
    .groupBy(contentPosts.status);

  const statusMap = new Map(byStatus.map((r) => [r.status, Number(r.count)]));
  const totalJobs = Array.from(statusMap.values()).reduce((a, b) => a + b, 0);
  const inFlight =
    (statusMap.get('processing') ?? 0) + (statusMap.get('scheduled') ?? 0);
  const deadLetters = statusMap.get('dead') ?? 0;
  const published = statusMap.get('published') ?? 0;
  const successRatePct =
    totalJobs > 0 ? Math.round((published / totalJobs) * 100) : 0;

  const latencyP95Ms = await calcLatencyP95(drizzle, since);

  return {
    asOf: new Date().toISOString(),
    byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    inFlight,
    deadLetters,
    successRatePct,
    latencyP95Ms,
    totalJobs,
  };
}

async function calcLatencyP95(
  drizzle: NonNullable<ReturnType<typeof db>>,
  since: Date,
): Promise<number | null> {
  try {
    const rows = await drizzle.execute(sql`
      SELECT percentile_disc(0.95) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (published_at - created_at)) * 1000
      ) AS p95_ms
      FROM content_post
      WHERE status = 'published'
        AND created_at >= ${since}
        AND published_at IS NOT NULL
    `);
    const row = (rows as unknown as Array<{ p95_ms: number | null }>)[0];
    return row?.p95_ms ? Math.round(row.p95_ms) : null;
  } catch {
    return null;
  }
}

async function getMemoryStats(since: Date): Promise<PublishingHealthStats> {
  const store = memoryStore() as unknown as {
    contentPosts?: Map<string, { id: string; status: string; createdAt: Date; publishedAt?: Date | null }>;
  };
  const jobs = store.contentPosts
    ? Array.from(store.contentPosts.values()).filter((j) => j.createdAt >= since)
    : [];

  const byStatusMap = new Map<string, number>();
  for (const j of jobs) {
    byStatusMap.set(j.status, (byStatusMap.get(j.status) ?? 0) + 1);
  }
  const byStatus = Array.from(byStatusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  const inFlight =
    (byStatusMap.get('processing') ?? 0) + (byStatusMap.get('scheduled') ?? 0);
  const deadLetters = byStatusMap.get('dead') ?? 0;
  const published = byStatusMap.get('published') ?? 0;
  const successRatePct =
    jobs.length > 0 ? Math.round((published / jobs.length) * 100) : 0;

  const latencies = jobs
    .filter((j) => j.status === 'published' && j.publishedAt)
    .map((j) => j.publishedAt!.getTime() - j.createdAt.getTime())
    .sort((a, b) => a - b);
  const latencyP95Ms =
    latencies.length > 0
      ? latencies[Math.floor(latencies.length * 0.95)] ?? null
      : null;

  return {
    asOf: new Date().toISOString(),
    byStatus,
    inFlight,
    deadLetters,
    successRatePct,
    latencyP95Ms,
    totalJobs: jobs.length,
  };
}

export interface RecentJob {
  id: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export async function listRecentPublishingJobs(
  limit = 20,
): Promise<RecentJob[]> {
  const drizzle = db();
  if (!drizzle) return [];
  const rows = await drizzle
    .select({
      id: contentPosts.id,
      status: contentPosts.status,
      scheduledAt: contentPosts.scheduledAt,
      publishedAt: contentPosts.publishedAt,
      createdAt: contentPosts.createdAt,
    })
    .from(contentPosts)
    .orderBy(desc(contentPosts.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listDeadLetters(
  lookbackHours = DEFAULT_LOOKBACK_HOURS,
): Promise<RecentJob[]> {
  const drizzle = db();
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  if (!drizzle) return [];
  const rows = await drizzle
    .select({
      id: contentPosts.id,
      status: contentPosts.status,
      scheduledAt: contentPosts.scheduledAt,
      publishedAt: contentPosts.publishedAt,
      createdAt: contentPosts.createdAt,
    })
    .from(contentPosts)
    .where(
      and(
        eq(contentPosts.status, 'dead'),
        gte(contentPosts.createdAt, since),
      ),
    )
    .orderBy(desc(contentPosts.createdAt))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}
