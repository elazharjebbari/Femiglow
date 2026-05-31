import { NextResponse } from 'next/server';
import { refreshRitualAggregate } from '@/lib/db/queries/rituals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PRODUCT_KEYS = ['pack-femiglow'];

export async function POST(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  const start = Date.now();
  const results: Array<{ productKey: string; total: number }> = [];
  for (const productKey of DEFAULT_PRODUCT_KEYS) {
    const agg = await refreshRitualAggregate(productKey);
    results.push({ productKey, total: agg.totalCount });
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    refreshedAt: new Date().toISOString(),
    results,
  });
}
