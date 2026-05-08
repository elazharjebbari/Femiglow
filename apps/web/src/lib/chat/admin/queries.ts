/**
 * Aggrégations Drizzle utilisées par les pages admin /admin/chat.
 *
 * On garde ces requêtes côté serveur uniquement (composants RSC) pour
 * ne pas exposer la SQL côté client. Toutes les listes paginent et
 * trient par `created_at` desc.
 */
import { and, count, desc, eq, gte, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';

import { rowsOf } from '@/lib/db/exec';

import { requireChatDb } from '../db/client';
import {
  chatConversationEvent,
  chatFeedback,
  chatKnowledgeSource,
  chatLead,
  chatMessage,
  chatProviderConfig,
  chatSession,
  chatThemePreset,
  type ChatLeadRow,
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

    // CHA-225 — "Conversions" = sessions converties via order link
    // (`chat_session.converted_at`) OU sessions ayant produit un lead
    // chat marqué `outcome='converted'`. Avant ce patch, on ne comptait
    // que la première condition, donc le KPI restait à 0 puisque rien
    // n'appelle `attributeConversion` en runtime aujourd'hui.
    const [conversions] = await db
      .select({ value: sql<number>`COUNT(DISTINCT ${chatSession.id})` })
      .from(chatSession)
      .leftJoin(chatLead, eq(chatLead.sessionId, chatSession.id))
      .where(
        and(
          gte(chatSession.openedAt, start),
          or(
            isNotNull(chatSession.convertedAt),
            eq(chatLead.outcome, 'converted'),
          ),
        ),
      );

    // KPI dédié leads chat capturés sur la fenêtre.
    const [leadsCaptured] = await db
      .select({ value: count() })
      .from(chatLead)
      .where(gte(chatLead.createdAt, start));

    const [leadsConverted] = await db
      .select({ value: count() })
      .from(chatLead)
      .where(and(gte(chatLead.createdAt, start), eq(chatLead.outcome, 'converted')));

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
      conversions: Number(conversions?.value ?? 0),
      leadsCaptured: leadsCaptured?.value ?? 0,
      leadsConverted: leadsConverted?.value ?? 0,
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
    /**
     * CHA-225 — filtre "conversion" :
     *  - 'yes' : ne renvoie que les sessions converties (order link OU
     *            chat_lead avec outcome='converted').
     *  - 'no'  : exclut les sessions converties.
     *  - undefined : pas de filtre.
     */
    converted?: 'yes' | 'no';
    limit?: number;
  }) {
    const db = requireChatDb();
    const limit = opts.limit ?? 50;

    // Pré-calcule l'ensemble des session ids "convertis" si nécessaire.
    // On utilise un sous-set côté Node plutôt qu'un JOIN à chaque requête,
    // pour ne pas dupliquer les lignes (un session peut avoir plusieurs
    // chat_lead) et garder la requête principale lisible.
    let convertedIdsFilter: { ids: Set<string> } | null = null;
    if (opts.converted) {
      const ids = await this.convertedSessionIds({
        fromDate: opts.fromDate,
        toDate: opts.toDate,
      });
      convertedIdsFilter = { ids: new Set(ids) };
    }

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
      const list = rowsOf(rows);
      if (!convertedIdsFilter) return list;
      return list.filter((s) =>
        opts.converted === 'yes'
          ? convertedIdsFilter!.ids.has(s.id)
          : !convertedIdsFilter!.ids.has(s.id),
      );
    }

    const conds = [];
    if (opts.language) conds.push(eq(chatSession.language, opts.language));
    if (opts.status) conds.push(eq(chatSession.status, opts.status));
    if (opts.fromDate) conds.push(gte(chatSession.openedAt, opts.fromDate));
    if (opts.toDate) conds.push(lte(chatSession.openedAt, opts.toDate));
    if (convertedIdsFilter) {
      const ids = Array.from(convertedIdsFilter.ids);
      if (opts.converted === 'yes') {
        if (ids.length === 0) return [];
        conds.push(inArray(chatSession.id, ids));
      } else if (ids.length > 0) {
        // exclure
        conds.push(sql`${chatSession.id} NOT IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
      }
    }

    return db
      .select()
      .from(chatSession)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(chatSession.lastSeenAt))
      .limit(limit);
  },

  /**
   * CHA-225 — Set des session ids converties (via order link OU lead
   * marqué converted). Sert de filtre pour `listConversations` et de
   * marqueur visuel ("voyant") dans la table.
   */
  async convertedSessionIds(opts: { fromDate?: Date; toDate?: Date } = {}): Promise<string[]> {
    const db = requireChatDb();
    const conds: ReturnType<typeof eq>[] = [isNotNull(chatSession.convertedAt)];
    if (opts.fromDate) conds.push(gte(chatSession.openedAt, opts.fromDate));
    if (opts.toDate) conds.push(lte(chatSession.openedAt, opts.toDate));
    const sessionRows = await db
      .select({ id: chatSession.id })
      .from(chatSession)
      .where(and(...conds));

    const leadConds: ReturnType<typeof eq>[] = [eq(chatLead.outcome, 'converted')];
    if (opts.fromDate) leadConds.push(gte(chatLead.createdAt, opts.fromDate));
    if (opts.toDate) leadConds.push(lte(chatLead.createdAt, opts.toDate));
    const leadRows = await db
      .select({ id: chatLead.sessionId })
      .from(chatLead)
      .where(and(...leadConds));

    const set = new Set<string>();
    for (const r of sessionRows) set.add(r.id);
    for (const r of leadRows) set.add(r.id);
    return Array.from(set);
  },

  /**
   * CHA-225 — Liste paginée des chat leads pour la console
   * `/admin/chat/leads`. Vue rapide à côté de `/admin/leads` qui mélange
   * leads ecommerce + chat ; ici on reste 100 % chat pour lecture rapide
   * (trigger reason, outcome, page d'origine).
   */
  async listChatLeads(opts: {
    outcome?: ChatLeadRow['outcome'];
    triggerReason?: ChatLeadRow['triggerReason'];
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  } = {}): Promise<ChatLeadRow[]> {
    const db = requireChatDb();
    const conds: ReturnType<typeof eq>[] = [];
    if (opts.outcome) conds.push(eq(chatLead.outcome, opts.outcome));
    if (opts.triggerReason) conds.push(eq(chatLead.triggerReason, opts.triggerReason));
    if (opts.fromDate) conds.push(gte(chatLead.createdAt, opts.fromDate));
    if (opts.toDate) conds.push(lte(chatLead.createdAt, opts.toDate));
    return db
      .select()
      .from(chatLead)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(chatLead.createdAt))
      .limit(opts.limit ?? 100);
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
