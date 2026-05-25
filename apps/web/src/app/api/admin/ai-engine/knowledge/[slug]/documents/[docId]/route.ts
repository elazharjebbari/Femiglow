import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { db } from '@/lib/db/client';
import {
  aiEngineKnowledgeDocuments,
  aiEngineKnowledgeChunks,
} from '@/lib/db/schema-ai-engine';
import { getCollection, updateCollectionCounts } from '@/lib/ai-engine/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: { slug: string; docId: string } },
): Promise<Response> {
  try {
    await requireAdminApi();

    const collection = await getCollection(params.slug);
    if (!collection) {
      throw new HttpError('not_found', `Collection "${params.slug}" not found`);
    }

    const drizzle = db();
    if (!drizzle) {
      return NextResponse.json(
        { error: 'Database non disponible' },
        { status: 503 },
      );
    }

    // Verify document exists and belongs to collection
    const docs = await drizzle
      .select({ id: aiEngineKnowledgeDocuments.id })
      .from(aiEngineKnowledgeDocuments)
      .where(
        and(
          eq(aiEngineKnowledgeDocuments.id, params.docId),
          eq(aiEngineKnowledgeDocuments.collectionId, collection.id),
        ),
      )
      .limit(1);

    if (docs.length === 0) {
      throw new HttpError('not_found', `Document "${params.docId}" not found`);
    }

    // Delete chunks first, then document
    await drizzle
      .delete(aiEngineKnowledgeChunks)
      .where(eq(aiEngineKnowledgeChunks.documentId, params.docId));

    await drizzle
      .delete(aiEngineKnowledgeDocuments)
      .where(eq(aiEngineKnowledgeDocuments.id, params.docId));

    // Update collection counts
    await updateCollectionCounts(collection.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
