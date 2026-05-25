import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { db } from '@/lib/db/client';
import { aiEngineGenerationJobs, aiEngineCostLedger } from '@/lib/db/schema-ai-engine';
import { sql, gte, and, eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- Types ---------- */

interface AnalyticsResponse {
  overview: {
    generationsToday: number;
    generationsWeek: number;
    generationsMonth: number;
    costTodayCents: number;
    costWeekCents: number;
    costMonthCents: number;
    avgQualityScore: number;
    successRate: number;
    errorRate: number;
  };
  costByProvider: Array<{ provider: string; costCents: number; count: number }>;
  costByNode: Array<{ nodeName: string; costCents: number; count: number }>;
  recentJobs: Array<{
    id: string;
    status: string;
    platform: string;
    format: string;
    contentType: string;
    totalCostCents: string;
    durationMs: number | null;
    createdAt: string;
  }>;
}

/* ---------- Mock data for MVP ---------- */

function getMockAnalytics(): AnalyticsResponse {
  return {
    overview: {
      generationsToday: 12,
      generationsWeek: 67,
      generationsMonth: 234,
      costTodayCents: 845,
      costWeekCents: 4520,
      costMonthCents: 15600,
      avgQualityScore: 0.82,
      successRate: 94.5,
      errorRate: 5.5,
    },
    costByProvider: [
      { provider: 'openai', costCents: 9200, count: 180 },
      { provider: 'anthropic', costCents: 4100, count: 38 },
      { provider: 'google', costCents: 1800, count: 12 },
      { provider: 'elevenlabs', costCents: 500, count: 4 },
    ],
    costByNode: [
      { nodeName: 'brief_analysis', costCents: 2400, count: 234 },
      { nodeName: 'script_writer', costCents: 4800, count: 234 },
      { nodeName: 'image_gen', costCents: 5200, count: 198 },
      { nodeName: 'caption_gen', costCents: 1900, count: 234 },
      { nodeName: 'quality_gate', costCents: 1300, count: 234 },
    ],
    recentJobs: [
      {
        id: 'mock-job-1',
        status: 'completed',
        platform: 'instagram',
        format: 'reel',
        contentType: 'awareness',
        totalCostCents: '72',
        durationMs: 14500,
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      },
      {
        id: 'mock-job-2',
        status: 'completed',
        platform: 'tiktok',
        format: 'reel',
        contentType: 'engagement',
        totalCostCents: '58',
        durationMs: 11200,
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      },
      {
        id: 'mock-job-3',
        status: 'failed',
        platform: 'instagram',
        format: 'carousel',
        contentType: 'conversion',
        totalCostCents: '23',
        durationMs: 5600,
        createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      },
      {
        id: 'mock-job-4',
        status: 'completed',
        platform: 'facebook',
        format: 'post',
        contentType: 'education',
        totalCostCents: '41',
        durationMs: 8900,
        createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      },
      {
        id: 'mock-job-5',
        status: 'completed',
        platform: 'instagram',
        format: 'story',
        contentType: 'awareness',
        totalCostCents: '35',
        durationMs: 7300,
        createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      },
    ],
  };
}

/* ---------- GET: analytics ---------- */

export async function GET(): Promise<Response> {
  try {
    await requireAdminApi();

    const database = db();
    if (!database) {
      return NextResponse.json(getMockAnalytics());
    }

    // Check if we have any jobs
    const jobCheck = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(aiEngineGenerationJobs);

    const totalJobs = jobCheck[0]?.count ?? 0;
    if (totalJobs === 0) {
      return NextResponse.json(getMockAnalytics());
    }

    // Time boundaries
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Generation counts
    const [countToday] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(aiEngineGenerationJobs)
      .where(gte(aiEngineGenerationJobs.createdAt, startOfDay));

    const [countWeek] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(aiEngineGenerationJobs)
      .where(gte(aiEngineGenerationJobs.createdAt, startOfWeek));

    const [countMonth] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(aiEngineGenerationJobs)
      .where(gte(aiEngineGenerationJobs.createdAt, startOfMonth));

    // Costs from ledger
    const [costToday] = await database
      .select({ total: sql<number>`coalesce(sum(cost_cents::numeric), 0)::int` })
      .from(aiEngineCostLedger)
      .where(gte(aiEngineCostLedger.createdAt, startOfDay));

    const [costWeek] = await database
      .select({ total: sql<number>`coalesce(sum(cost_cents::numeric), 0)::int` })
      .from(aiEngineCostLedger)
      .where(gte(aiEngineCostLedger.createdAt, startOfWeek));

    const [costMonth] = await database
      .select({ total: sql<number>`coalesce(sum(cost_cents::numeric), 0)::int` })
      .from(aiEngineCostLedger)
      .where(gte(aiEngineCostLedger.createdAt, startOfMonth));

    // Success/error rates (month)
    const [successCount] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(aiEngineGenerationJobs)
      .where(
        and(
          gte(aiEngineGenerationJobs.createdAt, startOfMonth),
          eq(aiEngineGenerationJobs.status, 'completed'),
        ),
      );

    const monthTotal = countMonth?.count ?? 0;
    const monthSuccess = successCount?.count ?? 0;
    const successRate = monthTotal > 0 ? (monthSuccess / monthTotal) * 100 : 100;
    const errorRate = monthTotal > 0 ? ((monthTotal - monthSuccess) / monthTotal) * 100 : 0;

    // Average quality score (month) — qualityScores is JSONB with an overallScore field
    const qualityRows = await database
      .select({
        avgScore: sql<number>`coalesce(avg((quality_scores->>'overallScore')::numeric), 0)::float`,
      })
      .from(aiEngineGenerationJobs)
      .where(
        and(
          gte(aiEngineGenerationJobs.createdAt, startOfMonth),
          sql`quality_scores->>'overallScore' is not null`,
        ),
      );
    const avgQualityScore = qualityRows[0]?.avgScore ?? 0;

    // Cost by provider (month)
    const costByProvider = await database
      .select({
        provider: aiEngineCostLedger.provider,
        costCents: sql<number>`coalesce(sum(cost_cents::numeric), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(aiEngineCostLedger)
      .where(gte(aiEngineCostLedger.createdAt, startOfMonth))
      .groupBy(aiEngineCostLedger.provider);

    // Cost by node (month)
    const costByNode = await database
      .select({
        nodeName: aiEngineCostLedger.nodeName,
        costCents: sql<number>`coalesce(sum(cost_cents::numeric), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(aiEngineCostLedger)
      .where(gte(aiEngineCostLedger.createdAt, startOfMonth))
      .groupBy(aiEngineCostLedger.nodeName);

    // Recent jobs (last 20)
    const recentJobs = await database
      .select({
        id: aiEngineGenerationJobs.id,
        status: aiEngineGenerationJobs.status,
        platform: aiEngineGenerationJobs.platform,
        format: aiEngineGenerationJobs.format,
        contentType: aiEngineGenerationJobs.contentType,
        totalCostCents: aiEngineGenerationJobs.totalCostCents,
        durationMs: aiEngineGenerationJobs.durationMs,
        createdAt: aiEngineGenerationJobs.createdAt,
      })
      .from(aiEngineGenerationJobs)
      .orderBy(sql`created_at desc`)
      .limit(20);

    const response: AnalyticsResponse = {
      overview: {
        generationsToday: countToday?.count ?? 0,
        generationsWeek: countWeek?.count ?? 0,
        generationsMonth: countMonth?.count ?? 0,
        costTodayCents: costToday?.total ?? 0,
        costWeekCents: costWeek?.total ?? 0,
        costMonthCents: costMonth?.total ?? 0,
        avgQualityScore: Math.round(avgQualityScore * 100) / 100,
        successRate: Math.round(successRate * 10) / 10,
        errorRate: Math.round(errorRate * 10) / 10,
      },
      costByProvider: costByProvider.map((r) => ({
        provider: r.provider,
        costCents: r.costCents,
        count: r.count,
      })),
      costByNode: costByNode.map((r) => ({
        nodeName: r.nodeName,
        costCents: r.costCents,
        count: r.count,
      })),
      recentJobs: recentJobs.map((r) => ({
        id: r.id,
        status: r.status,
        platform: r.platform,
        format: r.format,
        contentType: r.contentType,
        totalCostCents: r.totalCostCents,
        durationMs: r.durationMs,
        createdAt: r.createdAt.toISOString(),
      })),
    };

    return NextResponse.json(response);
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
