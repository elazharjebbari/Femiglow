import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { getTrends, clearTrendCache } from '@/lib/ai-engine/trends';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdminApi();

    const { searchParams } = new URL(request.url);
    const minScore = parseFloat(searchParams.get('minScore') ?? '0.4');
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const categories = searchParams.get('categories')?.split(',').filter(Boolean);
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (forceRefresh) clearTrendCache();

    const trends = await getTrends({ minScore, limit, categories, forceRefresh });

    return NextResponse.json({
      trends,
      meta: {
        count: trends.length,
        minScore,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
