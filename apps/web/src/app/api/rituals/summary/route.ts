import { NextResponse } from 'next/server';
import { getRitualSummary } from '@/lib/db/queries/rituals';

export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productKey = searchParams.get('product_key');
  if (!productKey) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'product_key requis' } },
      { status: 400 },
    );
  }

  try {
    const summary = await getRitualSummary(productKey);
    return NextResponse.json(
      { data: summary },
      {
        headers: {
          'Cache-Control':
            'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (e) {
    console.error('[rituals/summary] error', e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Erreur serveur' } },
      { status: 500 },
    );
  }
}
