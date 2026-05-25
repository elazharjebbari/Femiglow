import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getCollection, deleteCollection } from '@/lib/ai-engine/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
