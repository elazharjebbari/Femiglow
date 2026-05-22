/**
 * S3.3 — Aggregations for the Content Studio admin dashboard.
 *
 * Server-side only. Reads from the existing memory store / postgres via
 * `repository.ts` helpers. Pure functions are factored out so the unit
 * tests can feed them deterministic fixtures without touching the DB.
 *
 * Output shape is deliberately flat — the page renders it directly into
 * widgets without further mapping.
 */
import type {
  ContentPost,
  ContentGenerationRun,
  ContentPerformanceSnapshot,
} from './types';
import {
  listPosts,
  listGenerationRuns,
  listPerformanceSnapshotsForPosts,
} from './repository';
import {
  listPublishJobs,
  listSocialAccounts,
} from '@/lib/social-publishing/repository';
import type {
  SocialAccount,
  SocialPublishJob,
} from '@/lib/social-publishing/contracts';

export interface PostsThisWeek {
  total: number;
  dailyCounts: Array<{ date: string; count: number }>;
}

export interface JobSuccessRate {
  total: number;
  published: number;
  failed: number;
  rate: number;
}

export interface DraftsAwaitingReview {
  count: number;
  /** Hours since the oldest unreviewed draft was sent to the provider. */
  oldestAgeHours: number | null;
}

export interface MonthlyAiCost {
  cents: number;
  runs: number;
  monthLabel: string;
}

export interface AccountHealth {
  account: SocialAccount;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastFailureCode: string | null;
}

export interface TopPerformer {
  postId: string;
  capturedAt: Date;
  engagementRate: number;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  source: string;
}

export interface DashboardSnapshot {
  postsThisWeek: PostsThisWeek;
  jobSuccessRate: JobSuccessRate;
  monthlyAiCost: MonthlyAiCost;
  accountHealth: AccountHealth[];
  topPerformers: TopPerformer[];
  draftsAwaitingReview: DraftsAwaitingReview;
  generatedAt: Date;
}

export async function buildDashboardSnapshot(now: Date = new Date()): Promise<DashboardSnapshot> {
  const [posts, jobs, accounts, runs] = await Promise.all([
    listPosts(),
    listPublishJobs(),
    listSocialAccounts(),
    listGenerationRuns(1000),
  ]);

  const publishedPostIds = posts.filter((p) => p.status === 'published').map((p) => p.id);
  const snapshots =
    publishedPostIds.length > 0 ? await listPerformanceSnapshotsForPosts(publishedPostIds) : [];

  return {
    postsThisWeek: computePostsThisWeek(posts, now),
    jobSuccessRate: computeJobSuccessRate(jobs),
    monthlyAiCost: computeMonthlyAiCost(runs, now),
    accountHealth: computeAccountHealth(accounts, jobs),
    topPerformers: computeTopPerformers(snapshots, { limit: 5 }),
    draftsAwaitingReview: computeDraftsAwaitingReview(jobs, now),
    generatedAt: now,
  };
}

export function computePostsThisWeek(posts: ContentPost[], now: Date): PostsThisWeek {
  const start = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  const daily = new Map<string, number>();
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    daily.set(formatDay(day), 0);
  }
  let total = 0;
  for (const post of posts) {
    if (post.status !== 'published') continue;
    const publishedAt = post.publishedAt ?? post.scheduledAt;
    if (!publishedAt) continue;
    const day = formatDay(publishedAt);
    if (daily.has(day)) {
      daily.set(day, (daily.get(day) ?? 0) + 1);
      total += 1;
    }
  }
  return {
    total,
    dailyCounts: Array.from(daily.entries()).map(([date, count]) => ({ date, count })),
  };
}

export function computeJobSuccessRate(jobs: SocialPublishJob[]): JobSuccessRate {
  let published = 0;
  let failed = 0;
  for (const job of jobs) {
    // Drafts are sent to the provider for review, not actually published on
    // the social network. They live in their own widget — excluding them
    // here keeps the publication success rate semantically meaningful.
    if (job.content.publishMode === 'draft') continue;
    if (job.status === 'published') published += 1;
    else if (job.status === 'failed') failed += 1;
  }
  const total = published + failed;
  const rate = total === 0 ? 0 : Math.round((published / total) * 100);
  return { total, published, failed, rate };
}

export function computeDraftsAwaitingReview(
  jobs: SocialPublishJob[],
  now: Date,
): DraftsAwaitingReview {
  // A draft is "awaiting review" if it was successfully sent to the
  // provider (status=published) but the editorial content_post has not
  // yet been queued for real publication. We approximate the latter by
  // looking at the job's publishedAt being more than 0 hours old; the
  // dashboard only surfaces a count + oldest age, not an unbounded list.
  const drafts = jobs.filter(
    (job) => job.content.publishMode === 'draft' && job.status === 'published',
  );
  if (drafts.length === 0) {
    return { count: 0, oldestAgeHours: null };
  }
  let oldestTime = Number.POSITIVE_INFINITY;
  for (const job of drafts) {
    const ts = (job.publishedAt ?? job.updatedAt).getTime();
    if (ts < oldestTime) oldestTime = ts;
  }
  const oldestAgeHours = Math.max(0, Math.round((now.getTime() - oldestTime) / (60 * 60 * 1000)));
  return { count: drafts.length, oldestAgeHours };
}

export function computeMonthlyAiCost(runs: ContentGenerationRun[], now: Date): MonthlyAiCost {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthLabel = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`;
  let cents = 0;
  let count = 0;
  for (const run of runs) {
    if (run.createdAt < monthStart) continue;
    cents += run.costCents ?? 0;
    count += 1;
  }
  return { cents, runs: count, monthLabel };
}

export function computeAccountHealth(
  accounts: SocialAccount[],
  jobs: SocialPublishJob[],
): AccountHealth[] {
  const result: AccountHealth[] = [];
  for (const account of accounts) {
    const ownJobs = jobs.filter((job) => job.accountId === account.id);
    const lastPublished = ownJobs
      .filter((job) => job.status === 'published' && job.publishedAt)
      .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))[0];
    const lastFailed = ownJobs
      .filter((job) => job.status === 'failed')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    result.push({
      account,
      lastSuccessAt: lastPublished?.publishedAt ?? null,
      lastFailureAt: lastFailed?.updatedAt ?? null,
      lastFailureCode: lastFailed?.lastError?.code ?? null,
    });
  }
  return result.sort((a, b) => (b.lastSuccessAt?.getTime() ?? 0) - (a.lastSuccessAt?.getTime() ?? 0));
}

export function computeTopPerformers(
  snapshots: ContentPerformanceSnapshot[],
  options: { limit?: number } = {},
): TopPerformer[] {
  const limit = options.limit ?? 5;
  // Keep only the most recent snapshot per post: an ingestion run produces
  // overlapping daily entries, and we want the freshest view.
  const latestByPost = new Map<string, ContentPerformanceSnapshot>();
  for (const snap of snapshots) {
    const current = latestByPost.get(snap.postId);
    if (!current || snap.capturedAt.getTime() > current.capturedAt.getTime()) {
      latestByPost.set(snap.postId, snap);
    }
  }
  const enriched: TopPerformer[] = [];
  for (const snap of latestByPost.values()) {
    const metrics = snap.metrics as Record<string, unknown>;
    const engagementRate = toFinite(metrics.engagementRate);
    if (engagementRate === null) continue;
    enriched.push({
      postId: snap.postId,
      capturedAt: snap.capturedAt,
      engagementRate,
      impressions: toFinite(metrics.impressions),
      reach: toFinite(metrics.reach),
      likes: toFinite(metrics.likes),
      comments: toFinite(metrics.comments),
      shares: toFinite(metrics.shares),
      saves: toFinite(metrics.saves),
      source: snap.source,
    });
  }
  return enriched.sort((a, b) => b.engagementRate - a.engagementRate).slice(0, limit);
}

function toFinite(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDay(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

