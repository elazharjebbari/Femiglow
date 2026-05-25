import { NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { db } from '@/lib/db/client';
import {
  aiEngineKnowledgeDocuments,
  aiEngineKnowledgeChunks,
} from '@/lib/db/schema-ai-engine';
import { getEngineConfig } from '@/lib/ai-engine/config';
import { updateCollectionCounts } from '@/lib/ai-engine/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const BATCH_SIZE = 100;

export async function POST(): Promise<Response> {
  try {
    await requireAdminApi();

    const drizzle = db();
    if (!drizzle) {
      return NextResponse.json(
        { error: 'Base de données indisponible' },
        { status: 503 },
      );
    }

    const config = getEngineConfig();
    if (!config.apiKeys.openai) {
      return NextResponse.json(
        { error: 'Clé API OpenAI non configurée' },
        { status: 400 },
      );
    }

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.apiKeys.openai,
      modelName: 'text-embedding-3-small',
      dimensions: 1536,
    });

    const pendingDocs = await drizzle
      .select({
        id: aiEngineKnowledgeDocuments.id,
        collectionId: aiEngineKnowledgeDocuments.collectionId,
        title: aiEngineKnowledgeDocuments.title,
        contentText: aiEngineKnowledgeDocuments.contentText,
      })
      .from(aiEngineKnowledgeDocuments)
      .where(
        and(
          eq(aiEngineKnowledgeDocuments.chunkCount, 0),
          sql`${aiEngineKnowledgeDocuments.contentText} IS NOT NULL AND ${aiEngineKnowledgeDocuments.contentText} != ''`,
        ),
      );

    if (pendingDocs.length === 0) {
      return NextResponse.json({
        documentsProcessed: 0,
        chunksCreated: 0,
        message: 'Aucun document en attente d\'indexation',
      });
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });

    let totalDocuments = 0;
    let totalChunks = 0;
    const errors: string[] = [];
    const collectionIds = new Set<string>();

    for (const doc of pendingDocs) {
      try {
        const content = doc.contentText ?? '';
        if (!content) continue;

        const chunks = await splitter.splitText(content);

        let docChunkCount = 0;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE);
          const vectors = await embeddings.embedDocuments(batch);

          const chunkRows = batch.map((chunkContent, idx) => ({
            collectionId: doc.collectionId,
            documentId: doc.id,
            content: chunkContent,
            metadata: {
              chunkIndex: i + idx,
              totalChunks: chunks.length,
            } as Record<string, unknown>,
            embedding: vectors[idx]!,
          }));

          await drizzle.insert(aiEngineKnowledgeChunks).values(chunkRows);
          docChunkCount += batch.length;
        }

        await drizzle
          .update(aiEngineKnowledgeDocuments)
          .set({ chunkCount: docChunkCount })
          .where(eq(aiEngineKnowledgeDocuments.id, doc.id));

        collectionIds.add(doc.collectionId);
        totalDocuments++;
        totalChunks += docChunkCount;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        errors.push(`${doc.title}: ${message}`);
      }
    }

    for (const collectionId of collectionIds) {
      await updateCollectionCounts(collectionId);
    }

    const status = errors.length > 0 ? 207 : 200;
    return NextResponse.json(
      {
        documentsProcessed: totalDocuments,
        chunksCreated: totalChunks,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status },
    );
  } catch (err) {
    const errRes = formatErrorResponse(err);
    return NextResponse.json(errRes.body, { status: errRes.status });
  }
}
