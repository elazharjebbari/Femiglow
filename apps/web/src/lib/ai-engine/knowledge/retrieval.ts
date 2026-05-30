import { sql } from 'drizzle-orm';
import { OpenAIEmbeddings } from '@langchain/openai';
import { db } from '@/lib/db/client';
import { getEngineConfig } from '../config';
import { createLogger } from '../utils/logger';

const log = createLogger('knowledge:retrieval');

export interface SearchOptions {
  collectionSlugs?: string[];
  scoreThreshold?: number;
  k?: number;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  documentTitle: string;
  similarity: number;
}

function getEmbeddings(): OpenAIEmbeddings | null {
  const config = getEngineConfig();
  if (!config.apiKeys.openai) {
    log.warn('OpenAI API key not configured, search unavailable');
    return null;
  }
  return new OpenAIEmbeddings({
    openAIApiKey: config.apiKeys.openai,
    modelName: 'text-embedding-3-small',
    dimensions: 1536,
  });
}

export async function searchKnowledge(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const drizzle = db();
  if (!drizzle) {
    log.warn('No DB connection, returning empty search results');
    return [];
  }

  const embeddings = getEmbeddings();
  if (!embeddings) return [];

  const scoreThreshold = options.scoreThreshold ?? 0.7;
  const k = options.k ?? 5;
  const collectionSlugs = options.collectionSlugs ?? [];

  try {
    const startTime = Date.now();
    const queryEmbedding = await embeddings.embedQuery(query);
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    let results: SearchResult[];

    if (collectionSlugs.length > 0) {
      const rows = await drizzle.execute(sql`
        SELECT kc.id, kc.content, kc.metadata, kd.title as document_title,
               1 - (kc.embedding <=> ${vectorStr}::vector) as similarity
        FROM ai_engine_knowledge_chunk kc
        JOIN ai_engine_knowledge_document kd ON kc.document_id = kd.id
        JOIN ai_engine_knowledge_collection kco ON kc.collection_id = kco.id
        WHERE kco.slug = ANY(${collectionSlugs})
          AND kco.is_active = true
          AND 1 - (kc.embedding <=> ${vectorStr}::vector) >= ${scoreThreshold}
        ORDER BY similarity DESC
        LIMIT ${k}
      `);
      results = mapRows(rows);
    } else {
      const rows = await drizzle.execute(sql`
        SELECT kc.id, kc.content, kc.metadata, kd.title as document_title,
               1 - (kc.embedding <=> ${vectorStr}::vector) as similarity
        FROM ai_engine_knowledge_chunk kc
        JOIN ai_engine_knowledge_document kd ON kc.document_id = kd.id
        JOIN ai_engine_knowledge_collection kco ON kc.collection_id = kco.id
        WHERE kco.is_active = true
          AND 1 - (kc.embedding <=> ${vectorStr}::vector) >= ${scoreThreshold}
        ORDER BY similarity DESC
        LIMIT ${k}
      `);
      results = mapRows(rows);
    }

    const durationMs = Date.now() - startTime;
    log.info('Knowledge search completed', {
      query: query.slice(0, 80),
      resultCount: results.length,
      topScore: results[0]?.similarity ?? 0,
      durationMs,
    });

    return results;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error('Knowledge search failed', { error: message });
    return [];
  }
}

export async function searchByCollections(
  query: string,
  collectionSlugs: string[],
  k?: number,
): Promise<SearchResult[]> {
  return searchKnowledge(query, { collectionSlugs, k });
}

function mapRows(rows: unknown): SearchResult[] {
  const rowArray = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] })?.rows ?? [];
  return (rowArray as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    content: row.content as string,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
    documentTitle: row.document_title as string,
    similarity: Number(row.similarity),
  }));
}
