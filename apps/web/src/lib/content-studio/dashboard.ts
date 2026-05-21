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
import type { ContentPost, ContentGenerationRun } from './types';
import { listPosts, listGenerationRuns } from './repository';
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

export interface DashboardSnapshot {
  postsThisWeek: PostsThisWeek;
  jobSuccessRate: JobSuccessRate;
  monthlyAiCost: MonthlyAiCost;
  accountHealth: AccountHealth[];
  generatedAt: Date;
}

export async function buildDashboardSnapshot(now: Date = new Date()): Promise<DashboardSnapshot> {
  const [posts, jobs, accounts, runs] = await Promise.all([
    listPosts(),
    listPublishJobs(),
    listSocialAccounts(),
    listGenerationRuns(1000),
  ]);

  return {
    postsThisWeek: computePostsThisWeek(posts, now),
    jobSuccessRate: computeJobSuccessRate(jobs),
    monthlyAiCost: computeMonthlyAiCost(runs, now),
    accountHealth: computeAccountHealth(accounts, jobs),
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
    if (job.status === 'published') published += 1;
    else if (job.status === 'failed') failed += 1;
  }
  const total = published + failed;
  const rate = total === 0 ? 0 : Math.round((published / total) * 100);
  return { total, published, failed, rate };
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

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDay(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

