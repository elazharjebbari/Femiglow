import { NextResponse } from 'next/server';
import { listRituals } from '@/lib/db/queries/rituals';
import {
  RitualListQuerySchema,
  RitualSignalSchema,
  RitualTagSchema,
} from '@/lib/schemas/rituals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const productKey = searchParams.get('product_key');
  if (!productKey) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'product_key requis' } },
      { status: 400 },
    );
  }

  const tagsRaw = searchParams.get('tags');
  const tags = tagsRaw
    ? tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter((t) => RitualTagSchema.safeParse(t).success)
    : undefined;

  const signalRaw = searchParams.get('signal');
  const signal = signalRaw && RitualSignalSchema.safeParse(signalRaw).success
    ? (signalRaw as 'oui' | 'hesite' | 'non')
    : undefined;

  const parsed = RitualListQuerySchema.safeParse({
    productKey,
    withPhotos: searchParams.get('with_photos') === '1',
    tags,
    signal,
    featured: searchParams.get('featured') === '1',
    sort: searchParams.get('sort') ?? 'recommended',
    cursor: searchParams.get('cursor'),
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 12,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await listRituals(parsed.data);
    return NextResponse.json({
      data: result.items,
      meta: {
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        total: result.total,
      },
    });
  } catch (e) {
    console.error('[rituals/list] error', e);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Erreur serveur' } },
      { status: 500 },
    );
  }
}
