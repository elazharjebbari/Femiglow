/**
 * CHA-097 / CHA-098 — `ragService.retrieve` + `ragService.ingest`.
 *
 * - `ingest` : transforme une source (markdown/pdf/url/...) en chunks
 *   embedded, stockés en pgvector. Idempotent via raw_hash (re-ingest
 *   = noop si même hash).
 * - `retrieve` : prend une question + langue, embed la question, lance
 *   la recherche vector, applique re-rank heuristique, retourne 3-5
 *   chunks pertinents.
 *
 * cf. docs/chat-assistant/09-knowledge-base-rag.md
 */
import { createHash } from 'node:crypto';

import { logger } from '@/lib/logging/logger';

import type { ChatLanguage } from '../contracts';
import { providerRepo } from '../repos/provider';
import { instantiateProvider } from '../providers/factory';
import {
  chunkRepo,
  embeddingRepo,
  sourceRepo,
} from '../repos/knowledge';

import {
  loadDocx,
  loadFaq,
  loadMarkdown,
  loadPdf,
  loadUrl,
  type LoaderResult,
} from './loaders';
import { splitMarkdown } from './splitter';

export type RagSourceKind = 'url' | 'markdown' | 'pdf' | 'docx' | 'faq' | 'snippet';

export interface IngestInput {
  kind: RagSourceKind;
  label: string;
  language: ChatLanguage;
  audience?: 'public' | 'b2b' | 'all';
  freshness?: 'evergreen' | 'seasonal' | 'volatile';
  tags?: string[];
  /** Selon kind : URL, body markdown brut, FAQ pairs, buffer base64 (pdf/docx). */
  locator?: string;
  body?: string;
  pairs?: Array<{ q: string; a: string }>;
  buffer?: ArrayBuffer;
  createdBy?: string;
}

export interface IngestResult {
  sourceId: string;
  chunkCount: number;
  reused: boolean;
}

export interface RetrieveInput {
  question: string;
  language: ChatLanguage;
  topK?: number;
  minScore?: number;
}

export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  content: string;
  score: number;
  sourceLabel: string;
  sourceUrl?: string;
}

async function loadSource(input: IngestInput): Promise<LoaderResult> {
  switch (input.kind) {
    case 'url':
      if (!input.locator) throw new Error('locator is required for url');
      return loadUrl(input.locator);
    case 'markdown':
    case 'snippet':
      if (!input.body) throw new Error('body is required for markdown/snippet');
      return loadMarkdown(input.body, input.label);
    case 'faq':
      if (!input.pairs) throw new Error('pairs is required for faq');
      return loadFaq(input.pairs, input.label);
    case 'pdf':
      if (!input.buffer) throw new Error('buffer is required for pdf');
      return loadPdf(input.buffer);
    case 'docx':
      if (!input.buffer) throw new Error('buffer is required for docx');
      return loadDocx(input.buffer);
  }
}

async function embedTexts(
  texts: string[],
): Promise<{ vectors: number[][]; provider: string; model: string }> {
  // Choisit le 1er provider 'embedding' enabled.
  const list = await providerRepo.listByRole('embedding');
  const enabled = list.find((r) => r.enabled);
  if (!enabled) throw new Error('no embedding provider enabled');
  const config = providerRepo.decode(enabled);
  const adapter = instantiateProvider(config);
  if (!adapter.embed) throw new Error(`provider ${config.kind} does not support embed`);
  const result = await adapter.embed({ inputs: texts });
  return {
    vectors: result.vectors,
    provider: config.kind,
    model: result.modelName ?? config.embeddingModel ?? 'unknown',
  };
}

export const ragService = {
  async ingest(input: IngestInput): Promise<IngestResult> {
    const loaded = await loadSource(input);
    const rawHash = createHash('sha256').update(loaded.body).digest('hex');

    const existing = await sourceRepo.findByHash(rawHash, input.language);
    if (existing && existing.enabled) {
      logger.info('chat.rag.ingest.skip', {
        sourceId: existing.id,
        reason: 'identical-hash',
      });
      return { sourceId: existing.id, chunkCount: existing.chunkCount, reused: true };
    }

    // Crée ou met à jour la source
    const source = existing
      ? (await sourceRepo.update(existing.id, {
          lastIngestedAt: new Date(),
          chunkCount: 0,
        }))!
      : await sourceRepo.create({
          kind: input.kind,
          label: input.label,
          locator: input.locator,
          rawHash,
          language: input.language,
          tags: input.tags ?? [],
          audience: input.audience ?? 'all',
          freshness: input.freshness ?? 'evergreen',
          enabled: true,
          chunkCount: 0,
          createdBy: input.createdBy ?? 'admin',
        });

    if (existing) {
      // Re-ingest : on supprime les anciens chunks (cascade embeddings).
      await chunkRepo.deleteBySource(source.id);
    }

    // Split + embed
    const chunks = await splitMarkdown(loaded.body);
    if (chunks.length === 0) {
      logger.warn('chat.rag.ingest.empty', { sourceId: source.id });
      return { sourceId: source.id, chunkCount: 0, reused: false };
    }

    const { vectors, provider, model } = await embedTexts(
      chunks.map((c) => c.content),
    );

    const insertedChunks = await chunkRepo.insertMany(
      chunks.map((c) => ({
        sourceId: source.id,
        ordinal: c.ordinal,
        content: c.content,
        contentHash: createHash('sha256').update(c.content).digest('hex'),
        tokens: c.tokens,
        metadata: { ...c.metadata, ...loaded.metadata },
      })),
    );

    await embeddingRepo.insertMany(
      insertedChunks.map((c, i) => ({
        chunkId: c.id,
        embedderProvider: provider,
        embedderModel: model,
        dim: vectors[i]!.length,
        vector: vectors[i]!,
      })),
    );

    await sourceRepo.update(source.id, {
      chunkCount: insertedChunks.length,
      lastIngestedAt: new Date(),
    });

    logger.info('chat.rag.ingest.done', {
      sourceId: source.id,
      chunkCount: insertedChunks.length,
    });

    return { sourceId: source.id, chunkCount: insertedChunks.length, reused: false };
  },

  async retrieve(input: RetrieveInput): Promise<RetrievedChunk[]> {
    const topK = input.topK ?? 5;
    const minScore = input.minScore ?? 0.55;
    const { vectors } = await embedTexts([input.question]);
    const vector = vectors[0]!;
    const candidates = await embeddingRepo.searchSimilar(vector, {
      limit: topK * 2,
      minScore,
      language: input.language,
    });
    return rerank(candidates, input.question, topK).map((r) => ({
      chunkId: r.chunkId,
      sourceId: r.sourceId,
      content: r.content,
      score: r.score,
      sourceLabel: r.sourceLabel,
      sourceUrl: r.sourceLocator ?? undefined,
    }));
  },
};

/**
 * CHA-096 — Re-rank heuristique :
 * - boost si le chunk contient un keyword de la question (>4 chars),
 * - light penalty si le chunk est très long (> 1500 chars) → privilégie
 *   les chunks denses,
 * - tiebreaker : score cosine.
 */
function rerank<T extends { content: string; score: number }>(
  list: T[],
  question: string,
  topK: number,
): T[] {
  const keywords = question
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06FF]+/)
    .filter((w) => w.length > 4);
  const scored = list.map((item) => {
    let bonus = 0;
    const content = item.content.toLowerCase();
    for (const kw of keywords) {
      if (content.includes(kw)) bonus += 0.05;
    }
    if (item.content.length > 1500) bonus -= 0.03;
    return { item, finalScore: item.score + bonus };
  });
  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored.slice(0, topK).map((s) => s.item);
}
