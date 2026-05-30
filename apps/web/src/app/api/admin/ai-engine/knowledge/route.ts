import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { listCollections, createCollection } from '@/lib/ai-engine/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createCollectionSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).nullable().optional(),
  category: z.string().min(1).max(50),
});

export async function GET(): Promise<Response> {
  try {
    await requireAdminApi();
    const collections = await listCollections();
    return NextResponse.json({ collections });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.errors }, { status: 400 });
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdminApi();
    const body = await request.json();
    const parsed = createCollectionSchema.parse(body);
    const collection = await createCollection(
      parsed.name,
      parsed.slug,
      parsed.description ?? null,
      parsed.category,
    );
    return NextResponse.json({ collection }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.errors }, { status: 400 });
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
