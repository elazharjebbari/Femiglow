import { eq } from 'drizzle-orm';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import { db } from '@/lib/db/client';
import {
  aiEngineKnowledgeDocuments,
  aiEngineKnowledgeChunks,
} from '@/lib/db/schema-ai-engine';
import { getEngineConfig } from '../config';
import { createLogger } from '../utils/logger';
import { updateCollectionCounts } from './collections';

const log = createLogger('knowledge:ingestion');

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const BATCH_SIZE = 100;

function getEmbeddings(): OpenAIEmbeddings | null {
  const config = getEngineConfig();
  if (!config.apiKeys.openai) {
    log.warn('OpenAI API key not configured, embeddings unavailable');
    return null;
  }
  return new OpenAIEmbeddings({
    openAIApiKey: config.apiKeys.openai,
    modelName: 'text-embedding-3-small',
    dimensions: 1536,
  });
}

export interface IngestResult {
  documentId: string;
  chunkCount: number;
  success: boolean;
  error?: string;
}

export async function ingestText(
  collectionId: string,
  title: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<IngestResult> {
  const drizzle = db();
  if (!drizzle) {
    log.warn('No DB connection, cannot ingest text');
    return { documentId: '', chunkCount: 0, success: false, error: 'No database connection' };
  }

  const embeddings = getEmbeddings();
  if (!embeddings) {
    return { documentId: '', chunkCount: 0, success: false, error: 'OpenAI API key not configured' };
  }

  try {
    const startTime = Date.now();

    const [doc] = await drizzle
      .insert(aiEngineKnowledgeDocuments)
      .values({
        collectionId,
        title,
        sourceType: 'text',
        contentText: content,
        metadata: metadata ?? null,
      })
      .returning();

    const documentId = doc!.id;

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });
    const chunks = await splitter.splitText(content);

    let totalChunks = 0;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const vectors = await embeddings.embedDocuments(batch);

      const chunkRows = batch.map((chunkContent, idx) => ({
        collectionId,
        documentId,
        content: chunkContent,
        metadata: { chunkIndex: i + idx, totalChunks: chunks.length, ...metadata } as Record<string, unknown>,
        embedding: vectors[idx]!,
      }));

      await drizzle.insert(aiEngineKnowledgeChunks).values(chunkRows);
      totalChunks += batch.length;
    }

    await drizzle
      .update(aiEngineKnowledgeDocuments)
      .set({ chunkCount: totalChunks })
      .where(eq(aiEngineKnowledgeDocuments.id, documentId));

    await updateCollectionCounts(collectionId);

    const durationMs = Date.now() - startTime;
    log.info('Text ingested', { documentId, chunkCount: totalChunks, durationMs });

    return { documentId, chunkCount: totalChunks, success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error('Ingestion failed', { error: message });
    return { documentId: '', chunkCount: 0, success: false, error: message };
  }
}

export async function ingestUrl(
  collectionId: string,
  url: string,
): Promise<IngestResult> {
  try {
    log.info('Fetching URL for ingestion', { url });
    const response = await fetch(url, {
      headers: { 'User-Agent': 'FemiGlow-KnowledgeBot/1.0' },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return { documentId: '', chunkCount: 0, success: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const text = extractTextFromHtml(html);
    const title = extractTitleFromHtml(html) || new URL(url).hostname;

    return ingestText(collectionId, title, text, { sourceUrl: url, sourceType: 'url' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error('URL ingestion failed', { url, error: message });
    return { documentId: '', chunkCount: 0, success: false, error: message };
  }
}

function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|h[1-6]|li|tr|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return text;
}

function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return match ? match[1]!.trim() : null;
}
