import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { cms } from '@/lib/cms';
import { articleCategorySchema } from '@/lib/schemas';

const querySchema = z.object({
  cursor: z.string().regex(/^[a-z0-9-]+$/).optional(),
  category: articleCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const page = await cms.getArticlesPage(parsed.data);
  return NextResponse.json(page, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
