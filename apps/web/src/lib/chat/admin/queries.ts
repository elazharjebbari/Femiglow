/**
 * Aggrégations Drizzle utilisées par les pages admin /admin/chat.
 *
 * On garde ces requêtes côté serveur uniquement (composants RSC) pour
 * ne pas exposer la SQL côté client. Toutes les listes paginent et
 * trient par `created_at` desc.
 */
import { and, count, desc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';

import { requireChatDb } from '../db/client';
import {
  chatConversationEvent,
  chatFeedback,
  chatKnowledgeSource,
  chatMessage,
  chatProviderConfig,
  chatSession,
  chatThemePreset,
  type ChatSessionRow,
} from '../db/schema';

export type KpiWindow = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'all';

function windowStart(w: KpiWindow): Date {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  switch (w) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'yesterday':
      return new Date(now.getTime() - day);
    case '7d':
      return new Date(now.getTime() - 7 * day);
    case '30d':
      return new Date(now.getTime() - 30 * day);
    case '90d':
      return new Date(now.getTime() - 90 * day);
    case 'all':
      return new Date(0);
  }
}

export const adminQueries = {
  async overviewKpis(window: KpiWindow = '7d') {
    const db = requireChatDb();
    const start = windowStart(window);

    const [sessions] = await db
      .select({ value: count() })
      .from(chatSession)
      .where(gte(chatSession.openedAt, start));

    const [messagesUser] = await db
      .select({ value: count() })
      .from(chatMessage)
      .where(
        and(
          eq(chatMessage.role, 'user'),
          gte(chatMessage.createdAt, start),
          eq(chatMessage.status, 'sent'),
        ),
      );

    const [messagesAgent] = await db
      .select({ value: count() })
      .from(chatMessage)
      .where(
        and(
          eq(chatMessage.role, 'assistant'),
          gte(chatMessage.createdAt, start),
          eq(chatMessage.status, 'sent'),
        ),
      );

    const [conversions] = await db
      .select({ value: count() })
      .from(chatSession)
      .where(
        and(
          gte(chatSession.openedAt, start),
          isNotNull(chatSession.convertedAt),
        ),
      );

    const [feedbackPos] = await db
      .select({ value: count() })
      .from(chatFeedback)
      .where(and(eq(chatFeedback.value, 1), gte(chatFeedback.createdAt, start)));

    const [feedbackNeg] = await db
      .select({ value: count() })
      .from(chatFeedback)
      .where(and(eq(chatFeedback.value, -1), gte(chatFeedback.createdAt, start)));

    const costRows = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(cost), 0)::text AS total
        FROM chat_message
       WHERE role = 'assistant'
         AND status = 'sent'
         AND created_at >= ${start.toISOString()}::timestamptz
    `);
    const totalCostEur = Number.parseFloat(
      (costRows as { rows?: Array<{ total: string }> }).rows?.[0]?.total ?? '0',
    );

    const latencyRows = await db.execute<{ p50: number | null; p95: number | null }>(sql`
      SELECT
        percentile_disc(0.5)  WITHIN GROUP (ORDER BY latency_ms) AS p50,
        percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
      FROM chat_message
      WHERE role = 'assistant'
        AND status = 'sent'
        AND latency_ms IS NOT NULL
        AND created_at >= ${start.toISOString()}::timestamptz
    `);
    const lat = (latencyRows as { rows?: Array<{ p50: number | null; p95: number | null }> })
      .rows?.[0];

    return {
      window,
      sessions: sessions?.value ?? 0,
      messagesUser: messagesUser?.value ?? 0,
      messagesAgent: messagesAgent?.value ?? 0,
      conversions: conversions?.value ?? 0,
      feedbackPos: feedbackPos?.value ?? 0,
      feedbackNeg: feedbackNeg?.value ?? 0,
      totalCostEur,
      latencyP50: lat?.p50 ?? null,
      latencyP95: lat?.p95 ?? null,
    };
  },

  async listConversations(opts: {
    q?: string;
    language?: string;
    status?: ChatSessionRow['status'];
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }) {
    const db = requireChatDb();
    const limit = opts.limit ?? 50;
    if (opts.q && opts.q.trim().length > 0) {
      // Recherche full-text : trouve les sessions qui contiennent un
      // message matching la query, retourne la session unique la plus
      // récente.
      const rows = await db.execute<ChatSessionRow>(sql`
        SELECT s.*
          FROM chat_session s
          JOIN (
                 SELECT DISTINCT session_id
                   FROM chat_message
                  WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', ${opts.q})
               ) m ON m.session_id = s.id
         ORDER BY s.last_seen_at DESC
         LIMIT ${limit}
      `);
      return (rows.rows ?? (rows as unknown as ChatSessionRow[])) as ChatSessionRow[];
    }

    const conds = [];
    if (opts.language) conds.push(eq(chatSession.language, opts.language));
    if (opts.status) conds.push(eq(chatSession.status, opts.status));
    if (opts.fromDate) conds.push(gte(chatSession.openedAt, opts.fromDate));
    if (opts.toDate) conds.push(lte(chatSession.openedAt, opts.toDate));

    return db
      .select()
      .from(chatSession)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(chatSession.lastSeenAt))
      .limit(limit);
  },

  async listSources() {
    const db = requireChatDb();
    return db
      .select()
      .from(chatKnowledgeSource)
      .orderBy(desc(chatKnowledgeSource.updatedAt))
      .limit(200);
  },

  async listProviders() {
    const db = requireChatDb();
    return db
      .select()
      .from(chatProviderConfig)
      .orderBy(chatProviderConfig.role, chatProviderConfig.priority);
  },

  async listThemes() {
    const db = requireChatDb();
    return db.select().from(chatThemePreset).orderBy(desc(chatThemePreset.updatedAt));
  },

  async recentEvents(limit = 100) {
    const db = requireChatDb();
    return db
      .select()
      .from(chatConversationEvent)
      .orderBy(desc(chatConversationEvent.occurredAt))
      .limit(limit);
  },
};
