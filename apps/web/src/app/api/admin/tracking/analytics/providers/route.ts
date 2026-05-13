import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tracking/analytics/providers
 *
 * Agrégation par provider sur 7 jours :
 * - total events dispatched
 * - success / failed counts
 * - success_rate
 * - errors_count_24h (subset)
 * - avg_latency_ms (à partir de providers_results[kind].latencyMs)
 *
 * Source : `tracking_events_log` (pas de table dérivée — C4.T.1).
 * Cf. docs/tracking-improvement/60-analytics/.
 */
export interface ProviderAnalyticsRow {
  kind: string;
  total7d: number;
  sent7d: number;
  failed7d: number;
  errors24h: number;
  successRate7d: number;
  avgLatencyMs: number | null;
  conversions7d: number;
}

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const drizzle = db();
    if (!drizzle) {
      // En mode memory (tests/dev sans DB), on retourne une réponse vide
      // avec le même cache-control que le path nominal — comportement stable
      // côté UI quel que soit l'env.
      return NextResponse.json(
        { providers: [], generatedAt: new Date().toISOString() },
        { headers: { 'cache-control': 'no-store' } },
      );
    }

    // UNNEST sur providers_dispatched + lecture du JSON providers_results.
    // FILTER WHERE évite les NULL implicites des status undefined.
    const rows = await drizzle.execute(sql`
      WITH dispatched AS (
        SELECT
          received_at,
          is_conversion,
          UNNEST(providers_dispatched) AS kind,
          providers_results
        FROM tracking_events_log
        WHERE received_at >= NOW() - INTERVAL '7 days'
      )
      SELECT
        kind,
        COUNT(*) AS total_7d,
        COUNT(*) FILTER (
          WHERE (providers_results -> kind ->> 'status') IN ('sent', 'success')
        ) AS sent_7d,
        COUNT(*) FILTER (
          WHERE (providers_results -> kind ->> 'status') = 'failed'
        ) AS failed_7d,
        COUNT(*) FILTER (
          WHERE (providers_results -> kind ->> 'status') = 'failed'
            AND received_at >= NOW() - INTERVAL '24 hours'
        ) AS errors_24h,
        COUNT(*) FILTER (WHERE is_conversion = true) AS conversions_7d,
        AVG(NULLIF((providers_results -> kind ->> 'latencyMs')::numeric, 0)) AS avg_latency_ms
      FROM dispatched
      GROUP BY kind
      ORDER BY total_7d DESC
    `);

    const providers: ProviderAnalyticsRow[] = (
      rows as unknown as Array<Record<string, unknown>>
    ).map((r) => {
      const total = Number(r.total_7d ?? 0);
      const sent = Number(r.sent_7d ?? 0);
      return {
        kind: String(r.kind),
        total7d: total,
        sent7d: sent,
        failed7d: Number(r.failed_7d ?? 0),
        errors24h: Number(r.errors_24h ?? 0),
        successRate7d: total > 0 ? sent / total : 0,
        avgLatencyMs: r.avg_latency_ms != null ? Number(r.avg_latency_ms) : null,
        conversions7d: Number(r.conversions_7d ?? 0),
      };
    });

    return NextResponse.json(
      { providers, generatedAt: new Date().toISOString() },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
