import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getCollection, deleteCollection, updateCollection } from '@/lib/ai-engine/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchCollectionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().min(1).max(50).optional(),
}).refine((d) => d.name !== undefined || d.description !== undefined || d.category !== undefined, {
  message: 'At least one field must be provided',
});

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  try {
    await requireAdminApi();

    const collection = await getCollection(params.slug);
    if (!collection) {
      throw new HttpError('not_found', `Collection "${params.slug}" not found`);
    }

    const body = await request.json();
    const parsed = patchCollectionSchema.parse(body);

    const updated = await updateCollection(collection.id, parsed);

    return NextResponse.json({ collection: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: err.errors },
        { status: 400 },
      );
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  try {
    await requireAdminApi();

    const collection = await getCollection(params.slug);
    if (!collection) {
      throw new HttpError('not_found', `Collection "${params.slug}" not found`);
    }

    await deleteCollection(collection.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
