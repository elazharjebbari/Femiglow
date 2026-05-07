/**
 * CHA-018 — Repository chat_session.
 */
import { and, desc, eq, sql } from 'drizzle-orm';

import { createId } from '@/lib/ids';

import { requireChatDb } from '../db/client';
import { chatSession, type ChatSessionInsert, type ChatSessionRow } from '../db/schema';

export const sessionRepo = {
  async getById(id: string): Promise<ChatSessionRow | null> {
    const db = requireChatDb();
    const rows = await db.select().from(chatSession).where(eq(chatSession.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async getActiveByVisitor(visitorId: string): Promise<ChatSessionRow | null> {
    const db = requireChatDb();
    const rows = await db
      .select()
      .from(chatSession)
      .where(and(eq(chatSession.visitorId, visitorId), eq(chatSession.status, 'open')))
      .orderBy(desc(chatSession.lastSeenAt))
      .limit(1);
    return rows[0] ?? null;
  },

  async create(insert: Omit<ChatSessionInsert, 'id'>): Promise<ChatSessionRow> {
    const db = requireChatDb();
    const id = createId('cs');
    const rows = await db.insert(chatSession).values({ ...insert, id }).returning();
    return rows[0]!;
  },

  async update(id: string, partial: Partial<ChatSessionInsert>): Promise<ChatSessionRow | null> {
    const db = requireChatDb();
    const rows = await db
      .update(chatSession)
      .set({ ...partial, updatedAt: new Date() })
      .where(eq(chatSession.id, id))
      .returning();
    return rows[0] ?? null;
  },

  async touch(id: string): Promise<void> {
    const db = requireChatDb();
    await db
      .update(chatSession)
      .set({ lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(chatSession.id, id));
  },

  async archive(id: string): Promise<void> {
    const db = requireChatDb();
    await db
      .update(chatSession)
      .set({ status: 'archived', archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(chatSession.id, id));
  },

  async forget(id: string): Promise<void> {
    const db = requireChatDb();
    // Anonymise la session, droit à l'oubli RGPD.
    await db.execute(sql`
      UPDATE chat_session
         SET status = 'purged',
             purged_at = NOW(),
             visitor_id = encode(gen_random_bytes(16), 'hex'),
             fingerprint_hash = NULL,
             referrer = NULL,
             utm = NULL,
             meta_summary = NULL,
             updated_at = NOW()
       WHERE id = ${id}
    `);
  },
};
