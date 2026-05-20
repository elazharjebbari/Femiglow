import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';
import {
  insertPerformanceSnapshot,
  listPostizDeliveriesByStatus,
  listPostizDeliveriesForPosts,
} from './repository';
import { createDraftInPostiz, syncPostizIntegrations } from './service';
import { getPostizPostAnalytics, listPostizPosts } from './postiz';
import type { ContentPostizDelivery } from './types';

export interface PostizRetryCandidate {
  delivery: ContentPostizDelivery;
  scheduledAt: string | null;
}

export interface RetryPostizDeliveriesOptions {
  limit?: number;
  maxAttempts?: number;
  dryRun?: boolean;
}

export interface ImportPostizStatusOptions {
  pastDays?: number;
  futureDays?: number;
  limit?: number;
  dryRun?: boolean;
}

export interface ImportPostizPerformanceOptions {
  days?: number;
  limit?: number;
  dryRun?: boolean;
}

export async function syncPostizIntegrationsJob() {
  const startedAt = Date.now();
  const result = await syncPostizIntegrations();
  const tookMs = Date.now() - startedAt;

  logger.info('content_studio.postiz_sync.completed', {
    integrations: result.integrations.length,
    took_ms: tookMs,
  });
  await logAuditEvent({
    action: 'content_studio.postiz.integrations_synced',
    actorId: null,
    meta: {
      integrations: result.integrations.length,
      disabled: result.integrations.filter((integration) => integration.disabled).length,
      took_ms: tookMs,
    },
  });

  return { ...result, tookMs };
}

export async function retryPostizDeliveriesJob(options: RetryPostizDeliveriesOptions = {}) {
  const limit = clamp(options.limit ?? 5, 1, 25);
  const maxAttempts = clamp(options.maxAttempts ?? 3, 1, 10);
  const startedAt = Date.now();
  const failedDeliveries = await listPostizDeliveriesByStatus({
    statuses: ['failed'],
    limit: Math.max(limit * 4, 20),
  });
  const allDeliveriesForPosts = await listPostizDeliveriesForPosts(
    Array.from(new Set(failedDeliveries.map((delivery) => delivery.postId))),
  );
  const candidates = selectPostizRetryCandidates({
    failedDeliveries,
    allDeliveriesForPosts,
    limit,
    maxAttempts,
  });

  if (options.dryRun) {
    const tookMs = Date.now() - startedAt;
    return {
      dryRun: true,
      candidates: candidates.map((candidate) => serializeRetryCandidate(candidate)),
      retried: 0,
      succeeded: 0,
      failed: 0,
      skipped: failedDeliveries.length - candidates.length,
      tookMs,
    };
  }

  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ deliveryId: string; postId: string; error: string }> = [];

  for (const candidate of candidates) {
    try {
      await createDraftInPostiz({
        postId: candidate.delivery.postId,
        integrationId: candidate.delivery.integrationId,
        actorId: null,
        scheduledAt: candidate.scheduledAt,
        tags: [{ value: 'femiglow', label: 'FemiGlow' }],
      });
      succeeded += 1;
    } catch (err) {
      failed += 1;
      errors.push({
        deliveryId: candidate.delivery.id,
        postId: candidate.delivery.postId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const tookMs = Date.now() - startedAt;
  logger.info('content_studio.postiz_retry.completed', {
    candidates: candidates.length,
    succeeded,
    failed,
    took_ms: tookMs,
  });
  await logAuditEvent({
    action: 'content_studio.postiz.deliveries_retried',
    actorId: null,
    meta: {
      candidates: candidates.length,
      succeeded,
      failed,
      errors: errors.slice(0, 10),
      took_ms: tookMs,
    },
  });

  return {
    dryRun: false,
    candidates: candidates.map((candidate) => serializeRetryCandidate(candidate)),
    retried: candidates.length,
    succeeded,
    failed,
    skipped: failedDeliveries.length - candidates.length,
    errors,
    tookMs,
  };
}

export async function importPostizStatusJob(options: ImportPostizStatusOptions = {}) {
  const limit = clamp(options.limit ?? 25, 1, 100);
  const pastDays = clamp(options.pastDays ?? 30, 1, 180);
  const futureDays = clamp(options.futureDays ?? 30, 1, 180);
  const startedAt = Date.now();
  const sentDeliveries = (await listPostizDeliveriesByStatus({ statuses: ['sent'], limit: 200 }))
    .filter((delivery) => delivery.postizPostId)
    .slice(0, limit);

  if (options.dryRun) {
    return {
      dryRun: true,
      candidates: sentDeliveries.map(serializeDeliveryReference),
      imported: 0,
      missing: 0,
      tookMs: Date.now() - startedAt,
    };
  }

  const startDate = new Date(Date.now() - pastDays * 24 * 60 * 60 * 1000);
  const endDate = new Date(Date.now() + futureDays * 24 * 60 * 60 * 1000);
  const listed = await listPostizPosts({ startDate, endDate });
  const postizById = new Map(listed.posts.map((post) => [post.id, post]));

  let imported = 0;
  let missing = 0;
  for (const delivery of sentDeliveries) {
    const postizPost = delivery.postizPostId ? postizById.get(delivery.postizPostId) : null;
    if (!postizPost) {
      missing += 1;
      continue;
    }
    await insertPerformanceSnapshot({
      postId: delivery.postId,
      source: 'postiz_status',
      metrics: {
        deliveryId: delivery.id,
        postizPostId: delivery.postizPostId,
        state: postizPost.state ?? null,
        publishDate: postizPost.publishDate ?? null,
        releaseURL: postizPost.releaseURL ?? null,
        integration: postizPost.integration ?? null,
      },
    });
    imported += 1;
  }

  const tookMs = Date.now() - startedAt;
  await logAuditEvent({
    action: 'content_studio.postiz.status_imported',
    actorId: null,
    meta: {
      checked: sentDeliveries.length,
      imported,
      missing,
      postiz_status: listed.status,
      took_ms: tookMs,
    },
  });
  logger.info('content_studio.postiz_status.completed', {
    checked: sentDeliveries.length,
    imported,
    missing,
    postiz_status: listed.status,
    took_ms: tookMs,
  });

  return {
    dryRun: false,
    checked: sentDeliveries.length,
    imported,
    missing,
    postizStatus: listed.status,
    postizOk: listed.ok,
    tookMs,
  };
}

export async function importPostizPerformanceJob(options: ImportPostizPerformanceOptions = {}) {
  const limit = clamp(options.limit ?? 5, 1, 20);
  const days = clamp(options.days ?? 7, 1, 90);
  const startedAt = Date.now();
  const sentDeliveries = (await listPostizDeliveriesByStatus({ statuses: ['sent'], limit: 100 }))
    .filter((delivery) => delivery.postizPostId)
    .slice(0, limit);

  if (options.dryRun) {
    return {
      dryRun: true,
      candidates: sentDeliveries.map(serializeDeliveryReference),
      imported: 0,
      failed: 0,
      tookMs: Date.now() - startedAt,
    };
  }

  let imported = 0;
  let failed = 0;
  const errors: Array<{ deliveryId: string; postId: string; status: number }> = [];
  for (const delivery of sentDeliveries) {
    const postizPostId = delivery.postizPostId;
    if (!postizPostId) continue;
    const analytics = await getPostizPostAnalytics({ postId: postizPostId, days });
    if (!analytics.ok) {
      failed += 1;
      errors.push({ deliveryId: delivery.id, postId: delivery.postId, status: analytics.status });
      continue;
    }
    await insertPerformanceSnapshot({
      postId: delivery.postId,
      source: 'postiz_analytics',
      metrics: {
        deliveryId: delivery.id,
        postizPostId,
        days,
        analytics: analytics.body,
      },
    });
    imported += 1;
  }

  const tookMs = Date.now() - startedAt;
  await logAuditEvent({
    action: 'content_studio.postiz.performance_imported',
    actorId: null,
    meta: { checked: sentDeliveries.length, imported, failed, errors, took_ms: tookMs },
  });
  logger.info('content_studio.postiz_performance.completed', {
    checked: sentDeliveries.length,
    imported,
    failed,
    took_ms: tookMs,
  });

  return {
    dryRun: false,
    checked: sentDeliveries.length,
    imported,
    failed,
    errors,
    tookMs,
  };
}

export function selectPostizRetryCandidates(input: {
  failedDeliveries: ContentPostizDelivery[];
  allDeliveriesForPosts: ContentPostizDelivery[];
  limit: number;
  maxAttempts: number;
}): PostizRetryCandidate[] {
  const latestByPostAndIntegration = new Map<string, ContentPostizDelivery>();
  for (const delivery of input.allDeliveriesForPosts) {
    const key = deliveryKey(delivery);
    const existing = latestByPostAndIntegration.get(key);
    if (!existing || delivery.createdAt.getTime() > existing.createdAt.getTime()) {
      latestByPostAndIntegration.set(key, delivery);
    }
  }

  const seen = new Set<string>();
  const candidates: PostizRetryCandidate[] = [];
  for (const delivery of input.failedDeliveries) {
    const key = deliveryKey(delivery);
    if (seen.has(key)) continue;
    seen.add(key);

    const latest = latestByPostAndIntegration.get(key) ?? delivery;
    if (latest.id !== delivery.id || latest.status !== 'failed') continue;
    if (delivery.attemptCount >= input.maxAttempts) continue;

    candidates.push({
      delivery,
      scheduledAt: extractPostizScheduledAt(delivery.request),
    });
    if (candidates.length >= input.limit) break;
  }
  return candidates;
}

export function extractPostizScheduledAt(request: Record<string, unknown>): string | null {
  const value = request.date;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function serializeRetryCandidate(candidate: PostizRetryCandidate) {
  return {
    deliveryId: candidate.delivery.id,
    postId: candidate.delivery.postId,
    integrationId: candidate.delivery.integrationId,
    attemptCount: candidate.delivery.attemptCount,
    lastError: candidate.delivery.lastError,
    scheduledAt: candidate.scheduledAt,
  };
}

function serializeDeliveryReference(delivery: ContentPostizDelivery) {
  return {
    deliveryId: delivery.id,
    postId: delivery.postId,
    integrationId: delivery.integrationId,
    postizPostId: delivery.postizPostId,
    createdAt: delivery.createdAt.toISOString(),
  };
}

function deliveryKey(delivery: Pick<ContentPostizDelivery, 'postId' | 'integrationId'>): string {
  return `${delivery.postId}:${delivery.integrationId}`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}
