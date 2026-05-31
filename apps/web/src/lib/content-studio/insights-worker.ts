/**
 * S3.1 — Ingestion worker for `content_performance_snapshot`.
 *
 * Strategy:
 *  - Sweep publications whose `publishedAt` falls in the window
 *    [now - maxAgeHours, now - minAgeHours]. The 24h floor gives metrics time
 *    to stabilize after publish; the 72h ceiling keeps the workload bounded
 *    on each tick (a 6h cron + 48h sliding window means a publication is
 *    visited ~8 times worst-case, which is fine because each call is cheap
 *    and idempotent).
 *  - For each publication, locate its `SocialAccount`, dispatch to the
 *    adapter's `getInsights`, and persist a fresh snapshot.
 *  - Source key on the snapshot is `<provider>:<remoteId>:<dayBucket>` —
 *    one snapshot per provider/post/day. Re-running within the same UTC day
 *    is a no-op, so two back-to-back cron ticks produce identical state.
 */
import { logger } from '@/lib/logging/logger';
import {
  insertPerformanceSnapshot,
  listPerformanceSnapshotsForPosts,
} from '@/lib/content-studio/repository';
import {
  listSocialAccounts,
  listPublicationsForPost,
  listPublishJobs,
  type SocialAccount,
  type SocialPublication,
  type SocialPublishingAdapter,
} from '@/lib/social-publishing';
import { DryRunSocialPublishingAdapter } from '@/lib/social-publishing/adapters/dry-run';
import { PostizSocialPublishingAdapter } from '@/lib/social-publishing/adapters/postiz';
import type { SocialProviderId } from '@/lib/social-publishing/contracts';

export interface InsightsIngestionOptions {
  now?: Date;
  /** Lower bound: skip publications younger than this (default: 24h). */
  minAgeHours?: number;
  /** Upper bound: skip publications older than this (default: 72h). */
  maxAgeHours?: number;
  /** Max number of publications processed per run (default: 100). */
  limit?: number;
  /** Override the adapter resolver (used by tests). */
  resolveAdapter?: (provider: SocialProviderId) => SocialPublishingAdapter | null;
}

export interface InsightsIngestionSummary {
  scanned: number;
  ingested: number;
  skipped: number;
  failed: number;
  details: Array<{
    postId: string;
    provider: SocialProviderId;
    remoteId: string;
    outcome: 'ingested' | 'skipped' | 'failed';
    reason?: string;
  }>;
}

const dryRunAdapter = new DryRunSocialPublishingAdapter();
const postizAdapter = new PostizSocialPublishingAdapter();

function defaultResolveAdapter(provider: SocialProviderId): SocialPublishingAdapter | null {
  if (provider === 'dry_run') return dryRunAdapter;
  if (provider === 'postiz') return postizAdapter;
  return null;
}

export async function runInsightsIngestion(
  options: InsightsIngestionOptions = {},
): Promise<InsightsIngestionSummary> {
  const now = options.now ?? new Date();
  const minAgeMs = (options.minAgeHours ?? 24) * 60 * 60 * 1000;
  const maxAgeMs = (options.maxAgeHours ?? 72) * 60 * 60 * 1000;
  const limit = options.limit ?? 100;
  const resolveAdapter = options.resolveAdapter ?? defaultResolveAdapter;

  const upperBound = new Date(now.getTime() - minAgeMs);
  const lowerBound = new Date(now.getTime() - maxAgeMs);

  const summary: InsightsIngestionSummary = { scanned: 0, ingested: 0, skipped: 0, failed: 0, details: [] };

  const jobs = await listPublishJobs({ status: 'published' });
  const candidates = jobs
    .filter((job) => job.publishedAt && job.publishedAt >= lowerBound && job.publishedAt <= upperBound)
    .slice(0, limit);
  summary.scanned = candidates.length;
  if (candidates.length === 0) return summary;

  const accounts = await listSocialAccounts();
  const accountById = new Map<string, SocialAccount>(accounts.map((a) => [a.id, a]));

  const postIds = Array.from(new Set(candidates.map((job) => job.postId)));
  const existingSnapshots = await listPerformanceSnapshotsForPosts(postIds);

  for (const job of candidates) {
    const account = accountById.get(job.accountId);
    if (!account) {
      summary.skipped += 1;
      summary.details.push({
        postId: job.postId,
        provider: job.provider,
        remoteId: '',
        outcome: 'skipped',
        reason: 'account-not-found',
      });
      continue;
    }
    const publications = await listPublicationsForPost(job.postId);
    const publication = pickPublication(publications, job.accountId);
    if (!publication) {
      summary.skipped += 1;
      summary.details.push({
        postId: job.postId,
        provider: job.provider,
        remoteId: '',
        outcome: 'skipped',
        reason: 'publication-not-found',
      });
      continue;
    }

    const adapter = resolveAdapter(account.provider);
    if (!adapter?.getInsights) {
      summary.skipped += 1;
      summary.details.push({
        postId: job.postId,
        provider: account.provider,
        remoteId: publication.remoteId,
        outcome: 'skipped',
        reason: 'adapter-not-supported',
      });
      continue;
    }

    const sourceKey = buildSourceKey(account.provider, publication.remoteId, now);
    if (existingSnapshots.some((snap) => snap.postId === job.postId && snap.source === sourceKey)) {
      summary.skipped += 1;
      summary.details.push({
        postId: job.postId,
        provider: account.provider,
        remoteId: publication.remoteId,
        outcome: 'skipped',
        reason: 'already-ingested',
      });
      continue;
    }

    try {
      const result = await adapter.getInsights({ account, providerPostId: publication.remoteId });
      if (!result.ok) {
        summary.failed += 1;
        summary.details.push({
          postId: job.postId,
          provider: account.provider,
          remoteId: publication.remoteId,
          outcome: 'failed',
          reason: `${result.error.code}:${result.error.message}`,
        });
        logger.warn('content.insights.fetch_failed', {
          post_id: job.postId,
          provider: account.provider,
          remote_id: publication.remoteId,
          error_code: result.error.code,
        });
        continue;
      }
      await insertPerformanceSnapshot({
        postId: job.postId,
        source: sourceKey,
        metrics: {
          ...result.insights.metrics,
          provider: result.insights.provider,
          remoteId: result.insights.remoteId,
          capturedAt: result.insights.capturedAt,
        },
      });
      summary.ingested += 1;
      summary.details.push({
        postId: job.postId,
        provider: account.provider,
        remoteId: publication.remoteId,
        outcome: 'ingested',
      });
    } catch (err) {
      summary.failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      summary.details.push({
        postId: job.postId,
        provider: account.provider,
        remoteId: publication.remoteId,
        outcome: 'failed',
        reason: message,
      });
      logger.error('content.insights.unexpected_error', {
        post_id: job.postId,
        provider: account.provider,
        remote_id: publication.remoteId,
        error: message,
      });
    }
  }

  logger.info('content.insights.ingestion_completed', {
    scanned: summary.scanned,
    ingested: summary.ingested,
    skipped: summary.skipped,
    failed: summary.failed,
  });

  return summary;
}

function pickPublication(
  publications: SocialPublication[],
  accountId: string,
): SocialPublication | null {
  const match = publications.find((p) => p.accountId === accountId);
  if (match) return match;
  return publications[0] ?? null;
}

export function buildSourceKey(
  provider: SocialProviderId,
  remoteId: string,
  capturedAt: Date,
): string {
  const day = `${capturedAt.getUTCFullYear()}-${String(capturedAt.getUTCMonth() + 1).padStart(2, '0')}-${String(capturedAt.getUTCDate()).padStart(2, '0')}`;
  return `${provider}:${remoteId}:${day}`;
}
