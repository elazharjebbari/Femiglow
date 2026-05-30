import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  aiEngineGenerationJobs,
  aiEngineCostLedger,
} from '@/lib/db/schema-ai-engine';
import { createLogger } from '../utils/logger';
import type { GenerationRequest, GenerationResult } from '../orchestrator';

const log = createLogger('jobs:repository');

export interface JobRow {
  id: string;
  ideaId: string | null;
  status: string;
  platform: string;
  format: string;
  contentType: string;
  currentStep: string | null;
  briefInput: Record<string, unknown> | null;
  caption: string | null;
  hashtags: string[] | null;
  totalCostCents: number;
  qualityScores: Record<string, number> | null;
  durationMs: number | null;
  createdAt: Date;
  completedAt: Date | null;
}

export async function createJob(
  jobId: string,
  request: GenerationRequest,
): Promise<void> {
  const drizzle = db();
  if (!drizzle) return;

  try {
    await drizzle.insert(aiEngineGenerationJobs).values({
      id: jobId,
      status: 'running',
      briefInput: request.briefInput as Record<string, unknown>,
      platform: request.platform,
      format: request.format,
      contentType: request.contentType,
      currentStep: 'init',
    });
  } catch (err) {
    log.warn('Failed to create job record', { data: { error: String(err) } });
  }
}

export async function updateJobResult(
  jobId: string,
  result: GenerationResult,
): Promise<void> {
  const drizzle = db();
  if (!drizzle) return;

  try {
    await drizzle
      .update(aiEngineGenerationJobs)
      .set({
        status: result.status === 'failed' ? 'failed' : 'completed',
        caption: result.caption || null,
        hashtags: result.hashtags.length > 0 ? result.hashtags : null,
        totalCostCents: String((result.costTracking as Record<string, unknown>)?.totalCents ?? 0),
        costBreakdown: (result.costTracking as Record<string, unknown>)?.breakdown as Record<string, unknown> ?? null,
        tokensUsed: (result.costTracking as Record<string, unknown>)?.tokensUsed as Record<string, unknown> ?? null,
        qualityScores: result.qualityScores as Record<string, unknown>,
        moderationOk: (result.moderationResult as Record<string, unknown>)?.safe as boolean ?? null,
        errorLog: result.errors.length > 0 ? result.errors as unknown as Record<string, unknown> : null,
        durationMs: result.durationMs,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiEngineGenerationJobs.id, jobId));
  } catch (err) {
    log.warn('Failed to update job record', { data: { error: String(err) } });
  }
}

export async function updateJobStatus(
  jobId: string,
  status: string,
): Promise<void> {
  const drizzle = db();
  if (!drizzle) return;

  try {
    await drizzle
      .update(aiEngineGenerationJobs)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(aiEngineGenerationJobs.id, jobId));
  } catch (err) {
    log.warn('Failed to update job status', { data: { error: String(err) } });
  }
}

export async function getJob(jobId: string): Promise<JobRow | null> {
  const drizzle = db();
  if (!drizzle) return null;

  try {
    const rows = await drizzle
      .select()
      .from(aiEngineGenerationJobs)
      .where(eq(aiEngineGenerationJobs.id, jobId))
      .limit(1);

    const r = rows[0];
    if (!r) return null;

    return {
      id: r.id,
      ideaId: r.ideaId,
      status: r.status,
      platform: r.platform,
      format: r.format,
      contentType: r.contentType,
      currentStep: r.currentStep,
      briefInput: r.briefInput as Record<string, unknown> | null,
      caption: r.caption,
      hashtags: r.hashtags,
      totalCostCents: Number(r.totalCostCents ?? 0),
      qualityScores: r.qualityScores as Record<string, number> | null,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    };
  } catch (err) {
    log.warn('Failed to get job', { data: { error: String(err) } });
    return null;
  }
}

export async function recordCost(
  jobId: string,
  provider: string,
  model: string,
  nodeName: string,
  inputTokens: number,
  outputTokens: number,
  costCents: number,
): Promise<void> {
  const drizzle = db();
  if (!drizzle) return;

  try {
    await drizzle.insert(aiEngineCostLedger).values({
      jobId,
      provider,
      model,
      nodeName,
      inputTokens,
      outputTokens,
      costCents: String(costCents),
    });
  } catch (err) {
    log.warn('Failed to record cost', { data: { error: String(err) } });
  }
}

export async function listJobs(options?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<JobRow[]> {
  const drizzle = db();
  if (!drizzle) return [];

  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  try {
    const conditions = [];
    if (options?.status) {
      conditions.push(eq(aiEngineGenerationJobs.status, options.status));
    }

    const rows = await drizzle
      .select()
      .from(aiEngineGenerationJobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(aiEngineGenerationJobs.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.id,
      ideaId: r.ideaId,
      status: r.status,
      platform: r.platform,
      format: r.format,
      contentType: r.contentType,
      currentStep: r.currentStep,
      briefInput: r.briefInput as Record<string, unknown> | null,
      caption: r.caption,
      hashtags: r.hashtags,
      totalCostCents: Number(r.totalCostCents ?? 0),
      qualityScores: r.qualityScores as Record<string, number> | null,
      durationMs: r.durationMs,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    }));
  } catch (err) {
    log.warn('Failed to list jobs', { data: { error: String(err) } });
    return [];
  }
}

export async function getJobStats(period: 'day' | 'week' | 'month' = 'day'): Promise<{
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  totalCostCents: number;
  avgQualityScore: number;
  avgDurationMs: number;
}> {
  const drizzle = db();
  if (!drizzle) {
    return { totalJobs: 0, successfulJobs: 0, failedJobs: 0, totalCostCents: 0, avgQualityScore: 0, avgDurationMs: 0 };
  }

  const since = new Date();
  if (period === 'day') since.setDate(since.getDate() - 1);
  else if (period === 'week') since.setDate(since.getDate() - 7);
  else since.setMonth(since.getMonth() - 1);

  try {
    const rows = await drizzle
      .select()
      .from(aiEngineGenerationJobs)
      .where(gte(aiEngineGenerationJobs.createdAt, since));

    const total = rows.length;
    const successful = rows.filter((r) => r.status === 'completed').length;
    const failed = rows.filter((r) => r.status === 'failed').length;
    const totalCost = rows.reduce((sum, r) => sum + Number(r.totalCostCents ?? 0), 0);
    const qualities = rows
      .map((r) => (r.qualityScores as Record<string, number> | null)?.average)
      .filter((q): q is number => typeof q === 'number');
    const avgQuality = qualities.length > 0 ? qualities.reduce((a, b) => a + b, 0) / qualities.length : 0;
    const durations = rows.map((r) => r.durationMs).filter((d): d is number => typeof d === 'number');
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      totalJobs: total,
      successfulJobs: successful,
      failedJobs: failed,
      totalCostCents: totalCost,
      avgQualityScore: Math.round(avgQuality * 100) / 100,
      avgDurationMs: Math.round(avgDuration),
    };
  } catch {
    return { totalJobs: 0, successfulJobs: 0, failedJobs: 0, totalCostCents: 0, avgQualityScore: 0, avgDurationMs: 0 };
  }
}
