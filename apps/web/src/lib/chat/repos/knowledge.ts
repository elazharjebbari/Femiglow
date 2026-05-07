/**
 * CHA-094 — Repositories `chat_knowledge_*`.
 *
 * Chunks + embeddings. Recherche vector via `<=>` (cosine distance).
 */
import { eq, sql } from 'drizzle-orm';

import { createId } from '@/lib/ids';

import { requireChatDb } from '../db/client';
import {
  chatKnowledgeChunk,
  chatKnowledgeEmbedding,
  chatKnowledgeSource,
  type ChatKnowledgeChunkInsert,
  type ChatKnowledgeEmbeddingInsert,
  type ChatKnowledgeSourceInsert,
  type ChatKnowledgeSourceRow,
} from '../db/schema';

export const sourceRepo = {
  async getById(id: string): Promise<ChatKnowledgeSourceRow | null> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatKnowledgeSource)
      .where(eq(chatKnowledgeSource.id, id))
      .limit(1);
    return rows[0] ?? null;
  },

  async create(insert: Omit<ChatKnowledgeSourceInsert, 'id'>) {
    const db = requireChatDb();
    const id = createId('ck');
    const rows = await db
      .insert(chatKnowledgeSource)
      .values({ ...insert, id })
      .returning();
    return rows[0]!;
  },

  async update(id: string, partial: Partial<ChatKnowledgeSourceInsert>) {
    const db = requireChatDb();
    const rows = await db
      .update(chatKnowledgeSource)
      .set({ ...partial, updatedAt: new Date() })
      .where(eq(chatKnowledgeSource.id, id))
      .returning();
    return rows[0] ?? null;
  },

  async listEnabled() {
    const db = requireChatDb();
    return db
      .select()
      .from(chatKnowledgeSource)
      .where(eq(chatKnowledgeSource.enabled, true));
  },

  async findByHash(rawHash: string, language: string) {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatKnowledgeSource)
      .where(
        sql`${chatKnowledgeSource.rawHash} = ${rawHash} AND ${chatKnowledgeSource.language} = ${language}`,
      )
      .limit(1);
    return rows[0] ?? null;
  },
};

export const chunkRepo = {
  async deleteBySource(sourceId: string): Promise<void> {
    const db = requireChatDb();
    await db.delete(chatKnowledgeChunk).where(eq(chatKnowledgeChunk.sourceId, sourceId));
  },

  async insertMany(items: Array<Omit<ChatKnowledgeChunkInsert, 'id'>>) {
    if (items.length === 0) return [];
    const db = requireChatDb();
    const rows = await db
      .insert(chatKnowledgeChunk)
      .values(items.map((it) => ({ ...it, id: createId('kc') })))
      .returning();
    return rows;
  },

  async getById(id: string) {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatKnowledgeChunk)
      .where(eq(chatKnowledgeChunk.id, id))
      .limit(1);
    return rows[0] ?? null;
  },
};

export const embeddingRepo = {
  async insertMany(items: Array<Omit<ChatKnowledgeEmbeddingInsert, 'id'>>) {
    if (items.length === 0) return;
    const db = requireChatDb();
    await db
      .insert(chatKnowledgeEmbedding)
      .values(items.map((it) => ({ ...it, id: createId('ke') })));
  },

  /**
   * CHA-095 — Recherche vector via pgvector. Retourne chunks + score
   * (1 - cosine_distance, donc 1 = match parfait).
   */
  async searchSimilar(
    vector: number[],
    opts: { limit?: number; minScore?: number; language?: string } = {},
  ): Promise<
    Array<{
      chunkId: string;
      sourceId: string;
      content: string;
      score: number;
      metadata: Record<string, unknown> | null;
      sourceLabel: string;
      sourceLocator: string | null;
    }>
  > {
    const db = requireChatDb();
    const limit = opts.limit ?? 8;
    const minScore = opts.minScore ?? 0.55;
    const vectorLiteral = `[${vector.join(',')}]`;
    const rows = await db.execute<{
      chunk_id: string;
      source_id: string;
      content: string;
      score: number;
      metadata: Record<string, unknown> | null;
      source_label: string;
      source_locator: string | null;
    }>(sql`
      SELECT
        kc.id          AS chunk_id,
        kc.source_id   AS source_id,
        kc.content     AS content,
        1 - (ke.vector <=> ${vectorLiteral}::vector) AS score,
        kc.metadata    AS metadata,
        ks.label       AS source_label,
        ks.locator     AS source_locator
      FROM chat_knowledge_embedding ke
      JOIN chat_knowledge_chunk kc ON kc.id = ke.chunk_id
      JOIN chat_knowledge_source ks ON ks.id = kc.source_id
      WHERE ks.enabled = true
        ${opts.language ? sql`AND ks.language = ${opts.language}` : sql``}
      ORDER BY ke.vector <=> ${vectorLiteral}::vector ASC
      LIMIT ${limit}
    `);
    const list = (rows.rows ?? (rows as unknown as Array<Record<string, unknown>>)) as Array<{
      chunk_id: string;
      source_id: string;
      content: string;
      score: number;
      metadata: Record<string, unknown> | null;
      source_label: string;
      source_locator: string | null;
    }>;
    return list
      .filter((r) => Number(r.score) >= minScore)
      .map((r) => ({
        chunkId: r.chunk_id,
        sourceId: r.source_id,
        content: r.content,
        score: Number(r.score),
        metadata: r.metadata,
        sourceLabel: r.source_label,
        sourceLocator: r.source_locator,
      }));
  },
};
