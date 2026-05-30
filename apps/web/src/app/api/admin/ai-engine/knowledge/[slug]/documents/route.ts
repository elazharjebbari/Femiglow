import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { db } from '@/lib/db/client';
import { aiEngineKnowledgeDocuments } from '@/lib/db/schema-ai-engine';
import { getCollection, ingestText, ingestUrl } from '@/lib/ai-engine/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const ingestDocumentSchema = z.discriminatedUnion('sourceType', [
  z.object({
    sourceType: z.literal('text'),
    title: z.string().min(1).max(500),
    content: z.string().min(1),
    metadata: z.record(z.unknown()).optional(),
  }),
  z.object({
    sourceType: z.literal('url'),
    url: z.string().url(),
  }),
]);

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  try {
    await requireAdminApi();

    const collection = await getCollection(params.slug);
    if (!collection) {
      throw new HttpError('not_found', `Collection "${params.slug}" not found`);
    }

    const drizzle = db();
    if (!drizzle) {
      return NextResponse.json({ documents: [] });
    }

    const documents = await drizzle
      .select({
        id: aiEngineKnowledgeDocuments.id,
        title: aiEngineKnowledgeDocuments.title,
        sourceType: aiEngineKnowledgeDocuments.sourceType,
        sourceUrl: aiEngineKnowledgeDocuments.sourceUrl,
        chunkCount: aiEngineKnowledgeDocuments.chunkCount,
        createdAt: aiEngineKnowledgeDocuments.createdAt,
      })
      .from(aiEngineKnowledgeDocuments)
      .where(eq(aiEngineKnowledgeDocuments.collectionId, collection.id))
      .orderBy(desc(aiEngineKnowledgeDocuments.createdAt));

    return NextResponse.json({ documents });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.errors }, { status: 400 });
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}

export async function POST(
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
    const parsed = ingestDocumentSchema.parse(body);

    let result;
    if (parsed.sourceType === 'text') {
      result = await ingestText(collection.id, parsed.title, parsed.content, parsed.metadata);
    } else {
      result = await ingestUrl(collection.id, parsed.url);
    }

    if (!result.success) {
      return NextResponse.json(
        { error: 'Ingestion failed', detail: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { documentId: result.documentId, chunkCount: result.chunkCount },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.errors }, { status: 400 });
    }
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
