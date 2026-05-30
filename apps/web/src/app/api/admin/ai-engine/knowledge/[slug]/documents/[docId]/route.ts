import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { db } from '@/lib/db/client';
import {
  aiEngineKnowledgeDocuments,
  aiEngineKnowledgeChunks,
} from '@/lib/db/schema-ai-engine';
import { getCollection, updateCollectionCounts, getDocumentById } from '@/lib/ai-engine/knowledge';
import { updateDocument } from '@/lib/ai-engine/knowledge/ingestion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const patchDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(500_000).optional(),
}).refine((d) => d.title !== undefined || d.content !== undefined, {
  message: 'At least one field (title or content) must be provided',
});

export async function GET(
  _request: Request,
  { params }: { params: { slug: string; docId: string } },
): Promise<Response> {
  try {
    await requireAdminApi();

    const collection = await getCollection(params.slug);
    if (!collection) {
      throw new HttpError('not_found', `Collection "${params.slug}" not found`);
    }

    const doc = await getDocumentById(collection.id, params.docId);
    if (!doc) {
      throw new HttpError('not_found', `Document "${params.docId}" not found`);
    }

    return NextResponse.json({ document: doc });
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string; docId: string } },
): Promise<Response> {
  try {
    await requireAdminApi();

    const collection = await getCollection(params.slug);
    if (!collection) {
      throw new HttpError('not_found', `Collection "${params.slug}" not found`);
    }

    const body = await request.json();
    const parsed = patchDocumentSchema.parse(body);

    const result = await updateDocument(collection.id, params.docId, parsed);

    if (!result.success) {
      if (result.error === 'Document not found') {
        throw new HttpError('not_found', `Document "${params.docId}" not found`);
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      document: { id: result.documentId },
      reChunked: result.reChunked,
      chunkCount: result.chunkCount,
    });
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
