import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { db } from '@/lib/db/client';
import { aiEngineGenerationJobs, aiEngineCostLedger } from '@/lib/db/schema-ai-engine';
import { sql, gte, and, eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- Types ---------- */

interface NodeMetric {
  nodeId: string;
  label: string;
  provider: string;
  avgLatencyMs: number;
  avgCostCents: number;
  totalInvocations: number;
  errorCount: number;
  errorRate: number;
  status: 'healthy' | 'degraded' | 'error';
}

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
  nodeMetrics: NodeMetric[];
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

/* ---------- Pipeline node definitions ---------- */

/** All graph nodes with French labels and default providers. */
const PIPELINE_NODES: Array<{ id: string; label: string; defaultProvider: string }> = [
  { id: 'parseBrief', label: 'Analyse du brief', defaultProvider: 'openai' },
  { id: 'enrichKnowledge', label: 'Enrichissement savoir', defaultProvider: 'openai' },
  { id: 'enrichTrends', label: 'Enrichissement tendances', defaultProvider: 'openai' },
  { id: 'generateScript', label: 'Generation script', defaultProvider: 'openai' },
  { id: 'generateVideo', label: 'Generation video', defaultProvider: 'google' },
  { id: 'generateVoiceover', label: 'Voix off', defaultProvider: 'elevenlabs' },
  { id: 'generateMusic', label: 'Musique', defaultProvider: 'elevenlabs' },
  { id: 'generateSubtitles', label: 'Sous-titres', defaultProvider: 'openai' },
  { id: 'generateImages', label: 'Generation images', defaultProvider: 'openai' },
  { id: 'generateCaption', label: 'Generation caption', defaultProvider: 'openai' },
  { id: 'compose', label: 'Composition', defaultProvider: '-' },
  { id: 'transcodeExport', label: 'Transcodage / Export', defaultProvider: '-' },
  { id: 'qualityCheck', label: 'Controle qualite', defaultProvider: 'openai' },
  { id: 'moderate', label: 'Moderation', defaultProvider: 'openai' },
  { id: 'reviewGate', label: 'Revue humaine', defaultProvider: '-' },
  { id: 'generateVariants', label: 'Generation variantes', defaultProvider: 'openai' },
];

/* ---------- Default node metrics ---------- */

function getDefaultNodeMetrics(): NodeMetric[] {
  return PIPELINE_NODES.map((n) => ({
    nodeId: n.id,
    label: n.label,
    provider: n.defaultProvider,
    avgLatencyMs: 0,
    avgCostCents: 0,
    totalInvocations: 0,
    errorCount: 0,
    errorRate: 0,
    status: 'healthy' as const,
  }));
}

/* ---------- Mock data for MVP ---------- */

function getMockNodeMetrics(): NodeMetric[] {
  const mockData: Record<string, Partial<NodeMetric>> = {
    parseBrief: { avgLatencyMs: 1200, avgCostCents: 5, totalInvocations: 234, errorCount: 2 },
    enrichKnowledge: { avgLatencyMs: 2800, avgCostCents: 8, totalInvocations: 234, errorCount: 5 },
    enrichTrends: { avgLatencyMs: 3200, avgCostCents: 6, totalInvocations: 234, errorCount: 3 },
    generateScript: { avgLatencyMs: 4500, avgCostCents: 20, totalInvocations: 234, errorCount: 8 },
    generateVideo: { avgLatencyMs: 12000, avgCostCents: 45, totalInvocations: 48, errorCount: 4 },
    generateVoiceover: { avgLatencyMs: 6000, avgCostCents: 15, totalInvocations: 48, errorCount: 1 },
    generateMusic: { avgLatencyMs: 8000, avgCostCents: 12, totalInvocations: 48, errorCount: 0 },
    generateSubtitles: { avgLatencyMs: 2000, avgCostCents: 3, totalInvocations: 48, errorCount: 0 },
    generateImages: { avgLatencyMs: 8500, avgCostCents: 22, totalInvocations: 186, errorCount: 6 },
    generateCaption: { avgLatencyMs: 2200, avgCostCents: 8, totalInvocations: 234, errorCount: 1 },
    compose: { avgLatencyMs: 1500, avgCostCents: 0, totalInvocations: 234, errorCount: 2 },
    transcodeExport: { avgLatencyMs: 3500, avgCostCents: 0, totalInvocations: 234, errorCount: 3 },
    qualityCheck: { avgLatencyMs: 1800, avgCostCents: 5, totalInvocations: 234, errorCount: 0 },
    moderate: { avgLatencyMs: 1400, avgCostCents: 4, totalInvocations: 222, errorCount: 0 },
    reviewGate: { avgLatencyMs: 500, avgCostCents: 0, totalInvocations: 210, errorCount: 0 },
    generateVariants: { avgLatencyMs: 5500, avgCostCents: 18, totalInvocations: 195, errorCount: 3 },
  };

  return PIPELINE_NODES.map((n) => {
    const mock = mockData[n.id] ?? {};
    const invocations = mock.totalInvocations ?? 0;
    const errors = mock.errorCount ?? 0;
    const errRate = invocations > 0 ? (errors / invocations) * 100 : 0;
    let status: 'healthy' | 'degraded' | 'error' = 'healthy';
    if (errRate > 10) status = 'error';
    else if (errRate > 5) status = 'degraded';

    return {
      nodeId: n.id,
      label: n.label,
      provider: n.defaultProvider,
      avgLatencyMs: mock.avgLatencyMs ?? 0,
      avgCostCents: mock.avgCostCents ?? 0,
      totalInvocations: invocations,
      errorCount: errors,
      errorRate: Math.round(errRate * 10) / 10,
      status,
    };
  });
}

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
    nodeMetrics: getMockNodeMetrics(),
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

/* ---------- Build real node metrics from cost_ledger & jobs ---------- */

async function buildNodeMetrics(
  database: NonNullable<ReturnType<typeof db>>,
  since: Date,
): Promise<NodeMetric[]> {
  // Per-node cost stats from cost_ledger
  const ledgerStats = await database
    .select({
      nodeName: aiEngineCostLedger.nodeName,
      provider: sql<string>`mode() WITHIN GROUP (ORDER BY ${aiEngineCostLedger.provider})`,
      avgCostCents: sql<number>`coalesce(avg(cost_cents::numeric), 0)::float`,
      totalInvocations: sql<number>`count(*)::int`,
    })
    .from(aiEngineCostLedger)
    .where(gte(aiEngineCostLedger.createdAt, since))
    .groupBy(aiEngineCostLedger.nodeName);

  const ledgerMap = new Map(ledgerStats.map((r) => [r.nodeName, r]));

  // Job-level stats for latency and errors
  const jobRows = await database
    .select({
      durationMs: aiEngineGenerationJobs.durationMs,
      errorLog: aiEngineGenerationJobs.errorLog,
      status: aiEngineGenerationJobs.status,
    })
    .from(aiEngineGenerationJobs)
    .where(gte(aiEngineGenerationJobs.createdAt, since));

  const totalJobs = jobRows.length;
  const failedJobs = jobRows.filter((r) => r.status === 'failed').length;
  const durations = jobRows
    .map((r) => r.durationMs)
    .filter((d): d is number => typeof d === 'number' && d > 0);
  const avgTotalDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  // Approximate per-node latency: distribute total duration across the node count
  const nodeCount = PIPELINE_NODES.length;
  const avgNodeLatency = nodeCount > 0 ? avgTotalDuration / nodeCount : 0;

  // Count errors mentioned in error_log JSON arrays
  const errorsByNode = new Map<string, number>();
  for (const row of jobRows) {
    if (row.errorLog && Array.isArray(row.errorLog)) {
      for (const err of row.errorLog as Array<{ node?: string }>) {
        if (err && typeof err === 'object' && err.node) {
          errorsByNode.set(err.node, (errorsByNode.get(err.node) ?? 0) + 1);
        }
      }
    }
  }

  return PIPELINE_NODES.map((n) => {
    const ledger = ledgerMap.get(n.id);
    const invocations = ledger?.totalInvocations ?? 0;
    const errorCount = errorsByNode.get(n.id) ?? 0;
    const errRate = invocations > 0
      ? (errorCount / invocations) * 100
      : (totalJobs > 0 && failedJobs > 0) ? (failedJobs / totalJobs) * 100 * 0.1 : 0;

    let status: 'healthy' | 'degraded' | 'error' = 'healthy';
    if (errRate > 10) status = 'error';
    else if (errRate > 5) status = 'degraded';

    return {
      nodeId: n.id,
      label: n.label,
      provider: ledger?.provider ?? n.defaultProvider,
      avgLatencyMs: invocations > 0 ? Math.round(avgNodeLatency) : 0,
      avgCostCents: ledger ? Math.round(ledger.avgCostCents * 100) / 100 : 0,
      totalInvocations: invocations,
      errorCount,
      errorRate: Math.round(errRate * 10) / 10,
      status,
    };
  });
}

/* ---------- Period helper ---------- */

function getPeriodBoundary(period: string): Date {
  const now = new Date();
  switch (period) {
    case 'day': {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return d;
    }
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case 'month':
    default: {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return d;
    }
  }
}

/* ---------- GET: analytics ---------- */

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requireAdminApi();

    const { searchParams } = request.nextUrl;
    const includeNodeMetrics = searchParams.get('includeNodeMetrics') === 'true';
    const period = searchParams.get('period') ?? 'month';

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

    // For the selected period
    const periodSince = getPeriodBoundary(period);

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

    // Average quality score (month) -- qualityScores is JSONB with an overallScore field
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

    // Node metrics (if requested or always include for the graph viewer)
    let nodeMetrics: NodeMetric[];
    if (includeNodeMetrics) {
      nodeMetrics = await buildNodeMetrics(database, periodSince);
    } else {
      nodeMetrics = getDefaultNodeMetrics();
    }

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
      nodeMetrics,
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
