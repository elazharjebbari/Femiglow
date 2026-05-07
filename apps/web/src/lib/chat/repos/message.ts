/**
 * CHA-018 — Repository chat_message.
 */
import { and, desc, eq, sql } from 'drizzle-orm';

import { createId } from '@/lib/ids';

import { requireChatDb } from '../db/client';
import { chatMessage, type ChatMessageInsert, type ChatMessageRow } from '../db/schema';

export const messageRepo = {
  async listBySession(sessionId: string, limit = 50): Promise<ChatMessageRow[]> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.sessionId, sessionId))
      .orderBy(desc(chatMessage.createdAt))
      .limit(limit);
    return rows.reverse();
  },

  async getById(id: string): Promise<ChatMessageRow | null> {
    const db = requireChatDb();
    const rows = await db.select().from(chatMessage).where(eq(chatMessage.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async create(
    insert: Omit<ChatMessageInsert, 'id'> & { id?: string },
  ): Promise<ChatMessageRow> {
    const db = requireChatDb();
    const id = insert.id ?? createId('cm');
    const rows = await db.insert(chatMessage).values({ ...insert, id }).returning();
    return rows[0]!;
  },

  async update(id: string, partial: Partial<ChatMessageInsert>): Promise<ChatMessageRow | null> {
    const db = requireChatDb();
    const rows = await db
      .update(chatMessage)
      .set({ ...partial, updatedAt: new Date() })
      .where(eq(chatMessage.id, id))
      .returning();
    return rows[0] ?? null;
  },

  async deleteBySession(sessionId: string): Promise<void> {
    const db = requireChatDb();
    await db
      .update(chatMessage)
      .set({ content: '[supprimé]', contentRaw: null, contentSafe: null })
      .where(eq(chatMessage.sessionId, sessionId));
  },

  /** CHA-106 — Recherche plein texte admin. */
  async searchFullText(
    q: string,
    opts: { limit?: number; language?: string } = {},
  ): Promise<ChatMessageRow[]> {
    const db = requireChatDb();
    const limit = opts.limit ?? 50;
    // Utilise to_tsvector('simple', content) couvert par chat_message_fulltext_idx.
    const rows = await db.execute<ChatMessageRow>(sql`
      SELECT *
        FROM chat_message
       WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', ${q})
         ${opts.language ? sql`AND language = ${opts.language}` : sql``}
       ORDER BY created_at DESC
       LIMIT ${limit}
    `);
    return rows.rows ?? (rows as unknown as ChatMessageRow[]);
  },

  /** Sliding window pour la mémoire conversationnelle. */
  async recentForMemory(sessionId: string, k: number): Promise<ChatMessageRow[]> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatMessage)
      .where(
        and(
          eq(chatMessage.sessionId, sessionId),
          sql`${chatMessage.role} IN ('user', 'assistant')`,
          eq(chatMessage.status, 'sent'),
        ),
      )
      .orderBy(desc(chatMessage.createdAt))
      .limit(k);
    return rows.reverse();
  },
};
