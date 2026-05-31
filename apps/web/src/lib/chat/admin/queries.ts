/**
 * Aggrégations Drizzle utilisées par les pages admin /admin/chat.
 *
 * On garde ces requêtes côté serveur uniquement (composants RSC) pour
 * ne pas exposer la SQL côté client. Toutes les listes paginent et
 * trient par `created_at` desc.
 */
import { and, count, desc, eq, gte, inArray, isNotNull, lt, lte, or, sql } from 'drizzle-orm';

import { rowsOf } from '@/lib/db/exec';

import { requireChatDb } from '../db/client';
import {
  chatCannedPair,
  chatConversationEvent,
  chatFaqEntry,
  chatFeedback,
  chatGoldenIntentSet,
  chatKnowledgeSource,
  chatLead,
  chatMessage,
  chatProviderConfig,
  chatSession,
  chatThemePreset,
  type ChatMessageRow,
  type ChatCannedPairRow,
  type ChatFaqEntryRow,
  type ChatLeadRow,
  type ChatSessionRow,
} from '../db/schema';
import {
  ADMIN_CHAT_VISIBLE_KINDS,
  ADMIN_CHAT_VISIBLE_LEAD_SOURCES,
  type ChatSessionKind,
} from '../db/kind';
import { isChatAdminFiltersV2Enabled } from '../feature-flag';

// ----------------------------------------------------------------------------
// CHA-LEAD-V2 — Helpers pour filtres admin V2 (kind + source).
// ----------------------------------------------------------------------------

/**
 * Construit la SQL condition pour filtrer `chat_session` par kind.
 * Quand le feature flag est off, renvoie undefined (no-op).
 */
function buildKindFilter(kinds?: ReadonlyArray<ChatSessionKind>) {
  if (!isChatAdminFiltersV2Enabled()) return undefined;
  const allowed = kinds && kinds.length > 0 ? kinds : ADMIN_CHAT_VISIBLE_KINDS;
  return inArray(chatSession.kind, [...allowed]);
}

/**
 * Construit la SQL condition pour filtrer `chat_lead` par source.
 * Quand le feature flag est off, renvoie undefined (no-op).
 */
function buildSourceFilter(sources?: ReadonlyArray<ChatLeadRow['source']>) {
  if (!isChatAdminFiltersV2Enabled()) return undefined;
  const allowed = sources && sources.length > 0 ? sources : ADMIN_CHAT_VISIBLE_LEAD_SOURCES;
  return inArray(chatLead.source, [...allowed]);
}

/**
 * Condition SQL : "la session a au moins un chat_message user/sent".
 * Returns undefined quand le filtre est désactivé.
 */
function buildHasUserMessageFilter() {
  if (!isChatAdminFiltersV2Enabled()) return undefined;
  return sql`EXISTS (
    SELECT 1 FROM ${chatMessage} m
     WHERE m.session_id = ${chatSession.id}
       AND m.role = 'user'
       AND m.status = 'sent'
  )`;
}

export type KpiWindow = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'all';

export function windowStart(w: KpiWindow): Date {
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
    /**
     * CHA-LEAD-V2 — Filtre `kind` (default `['chat']` quand flag V2 ON).
     * Override pour vues de debug ou pages d'audit dédiées.
     */
    kinds?: ReadonlyArray<ChatSessionKind>;
    /**
     * CHA-LEAD-V2 — Si true (default), exclut les sessions sans
     * `chat_message` role='user' status='sent'. Désactivable via
     * `?debug=ghosts`.
     */
    withMessagesOnly?: boolean;
    limit?: number;
  }) {
    const db = requireChatDb();
    const limit = opts.limit ?? 50;
    const withMessagesOnly = opts.withMessagesOnly ?? true;

    // Pré-calcule l'ensemble des session ids "convertis" si nécessaire.
    let convertedIdsFilter: { ids: Set<string> } | null = null;
    if (opts.converted) {
      const ids = await this.convertedSessionIds({
        fromDate: opts.fromDate,
        toDate: opts.toDate,
        kinds: opts.kinds,
      });
      convertedIdsFilter = { ids: new Set(ids) };
    }

    if (opts.q && opts.q.trim().length > 0) {
      // Recherche full-text. Le filtre kind est appliqué en post-Node faute
      // de pouvoir l'injecter proprement dans la requête SQL ci-dessous.
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
      let list = rowsOf(rows);
      if (isChatAdminFiltersV2Enabled()) {
        const allowedKinds = opts.kinds && opts.kinds.length > 0
          ? new Set<ChatSessionKind>(opts.kinds)
          : new Set<ChatSessionKind>(ADMIN_CHAT_VISIBLE_KINDS);
        list = list.filter((s) => allowedKinds.has(s.kind as ChatSessionKind));
      }
      if (!convertedIdsFilter) return list;
      return list.filter((s) =>
        opts.converted === 'yes'
          ? convertedIdsFilter!.ids.has(s.id)
          : !convertedIdsFilter!.ids.has(s.id),
      );
    }

    const conds = [];
    const kindCond = buildKindFilter(opts.kinds);
    if (kindCond) conds.push(kindCond);
    if (withMessagesOnly) {
      const msgCond = buildHasUserMessageFilter();
      if (msgCond) conds.push(msgCond);
    }
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
  async convertedSessionIds(opts: {
    fromDate?: Date;
    toDate?: Date;
    /** CHA-LEAD-V2 — Default ['chat']. */
    kinds?: ReadonlyArray<ChatSessionKind>;
  } = {}): Promise<string[]> {
    const db = requireChatDb();
    const conds: ReturnType<typeof eq>[] = [isNotNull(chatSession.convertedAt)];
    const kindCond = buildKindFilter(opts.kinds);
    if (kindCond) conds.push(kindCond);
    if (opts.fromDate) conds.push(gte(chatSession.openedAt, opts.fromDate));
    if (opts.toDate) conds.push(lte(chatSession.openedAt, opts.toDate));
    const sessionRows = await db
      .select({ id: chatSession.id })
      .from(chatSession)
      .where(and(...conds));

    // CHA-LEAD-V2 — Lead-based conversions filtrées par source (sinon un
    // wizard_kit converted polluerait ici).
    const leadConds: ReturnType<typeof eq>[] = [eq(chatLead.outcome, 'converted')];
    const leadSourceCond = buildSourceFilter();
    if (leadSourceCond) leadConds.push(leadSourceCond);
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
    /**
     * CHA-LEAD-V2 — Filtre `source` (default `['chat_widget', 'inline']`
     * quand flag V2 ON). Override possible (ex. `/admin/leads` veut tout).
     */
    sources?: ReadonlyArray<ChatLeadRow['source']>;
    limit?: number;
  } = {}): Promise<ChatLeadRow[]> {
    const db = requireChatDb();
    const conds: ReturnType<typeof eq>[] = [];
    const sourceCond = buildSourceFilter(opts.sources);
    if (sourceCond) conds.push(sourceCond);
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

  // -------------------------------------------------------------------------
  // CHA-230 Phase 3 — curator / quality dashboard
  // -------------------------------------------------------------------------

  /**
   * Liste paginée des messages user récents avec leur intent classifié,
   * pour la page `/admin/chat/intent-curator`.
   *
   * Filtres optionnels : intent, langue, méthode (regex/llm), date min.
   * Par défaut : derniers 7 j, role=user, limit 100, ordre desc.
   */
  async listMessagesForCurator(
    opts: {
      intent?: string;
      language?: string;
      method?: 'regex' | 'llm' | 'llm-fixed' | 'golden' | 'manual';
      since?: Date;
      limit?: number;
    } = {},
  ): Promise<ChatMessageRow[]> {
    const db = requireChatDb();
    const start = opts.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const conds = [
      eq(chatMessage.role, 'user'),
      gte(chatMessage.createdAt, start),
      isNotNull(chatMessage.intentTag),
    ];
    if (opts.intent) conds.push(eq(chatMessage.intentTag, opts.intent));
    if (opts.language) conds.push(eq(chatMessage.language, opts.language));
    if (opts.method) conds.push(eq(chatMessage.intentMethod, opts.method));

    return db
      .select()
      .from(chatMessage)
      .where(and(...conds))
      .orderBy(desc(chatMessage.createdAt))
      .limit(opts.limit ?? 100);
  },

  /**
   * Aggrégats pour le quality dashboard. Retourne, pour la fenêtre
   * donnée, le nombre de messages user par intent_tag, par méthode,
   * et la part golden-tagué.
   */
  async qualityKpis(window: KpiWindow = '7d') {
    const db = requireChatDb();
    const start = windowStart(window);

    // Distribution par intent.
    const byIntent = await db
      .select({
        intent: chatMessage.intentTag,
        n: sql<number>`COUNT(*)::int`,
      })
      .from(chatMessage)
      .where(
        and(
          eq(chatMessage.role, 'user'),
          gte(chatMessage.createdAt, start),
          isNotNull(chatMessage.intentTag),
        ),
      )
      .groupBy(chatMessage.intentTag)
      .orderBy(desc(sql`COUNT(*)`));

    // Distribution par méthode (regex vs llm vs llm-fixed).
    const byMethod = await db
      .select({
        method: chatMessage.intentMethod,
        n: sql<number>`COUNT(*)::int`,
      })
      .from(chatMessage)
      .where(
        and(
          eq(chatMessage.role, 'user'),
          gte(chatMessage.createdAt, start),
          isNotNull(chatMessage.intentMethod),
        ),
      )
      .groupBy(chatMessage.intentMethod);

    // Distribution par confiance.
    const byConfidence = await db
      .select({
        confidence: chatMessage.intentConfidence,
        n: sql<number>`COUNT(*)::int`,
      })
      .from(chatMessage)
      .where(
        and(
          eq(chatMessage.role, 'user'),
          gte(chatMessage.createdAt, start),
          isNotNull(chatMessage.intentConfidence),
        ),
      )
      .groupBy(chatMessage.intentConfidence);

    // Total golden-set (cumulé, indépendant de la fenêtre).
    const [goldenTotal] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(chatGoldenIntentSet);

    return {
      byIntent: byIntent.map((r) => ({ intent: r.intent ?? '∅', count: r.n })),
      byMethod: byMethod.map((r) => ({ method: r.method ?? '∅', count: r.n })),
      byConfidence: byConfidence.map((r) => ({
        confidence: r.confidence ?? '∅',
        count: r.n,
      })),
      goldenTotal: goldenTotal?.n ?? 0,
    };
  },

  // -------------------------------------------------------------------------
  // CHA-231 Phase 6 — Lead funnel & resilience (quality dashboard widget)
  // -------------------------------------------------------------------------

  /**
   * Aggrégats du funnel lead-form sur la fenêtre choisie. Retourne :
   *   - offered  : nombre d'offres `chat_lead_form_offered` poussées au client.
   *   - submitted: nombre de leads créés via `chat_lead_form_submit` (capture
   *                explicite avec consent RGPD).
   *   - autoCreated : nombre de leads `chat_lead_auto_created` (filet
   *                inline-contact — phone détecté en clair sans formulaire).
   *   - dismissed: nombre d'offres rejetées par l'utilisateur.
   *   - byReason : ventilation des offres par `payload->>'reason'`.
   *   - retryFallbackCount : compte des bascules retry/fallback provider.
   *
   * Utilisé par `/admin/chat/quality` (widget « Lead funnel & résilience »).
   *
   * Implémentation : on lit `chat_conversation_event` (append-only KPI) et
   * pas `chat_lead` direct — pour rester homogène avec les autres KPIs et
   * pour pouvoir filtrer sur la fenêtre temps via `occurred_at`.
   */
  async leadFunnelKpis(window: KpiWindow = '7d') {
    const db = requireChatDb();
    const start = windowStart(window);

    // Total des offres + ventilation par raison (purchase-intent / negotiation
    // / wholesaler / etc). On récupère en un seul scan.
    const byReasonRows = await db.execute<{ reason: string; n: number }>(sql`
      SELECT
        COALESCE(payload->>'reason', 'unknown') AS reason,
        COUNT(*)::int AS n
        FROM chat_conversation_event
       WHERE type = 'chat_lead_form_offered'
         AND occurred_at >= ${start.toISOString()}::timestamptz
       GROUP BY reason
       ORDER BY n DESC
    `);
    const byReason = (
      (byReasonRows as { rows?: Array<{ reason: string; n: number }> }).rows ??
      []
    ).map((r) => ({ reason: r.reason, count: Number(r.n) }));
    const offered = byReason.reduce((sum, r) => sum + r.count, 0);

    // Capture (RGPD) — submission explicite du formulaire.
    const [submitted] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(chatConversationEvent)
      .where(
        and(
          eq(chatConversationEvent.type, 'chat_lead_form_submit'),
          gte(chatConversationEvent.occurredAt, start),
        ),
      );

    // Capture filet de sécurité — phone détecté inline.
    const [autoCreated] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(chatConversationEvent)
      .where(
        and(
          eq(chatConversationEvent.type, 'chat_lead_auto_created'),
          gte(chatConversationEvent.occurredAt, start),
        ),
      );

    // Dismissals (utilisateur a fermé l'offre sans soumettre).
    const [dismissed] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(chatConversationEvent)
      .where(
        and(
          eq(chatConversationEvent.type, 'chat_lead_form_dismiss'),
          gte(chatConversationEvent.occurredAt, start),
        ),
      );

    // Retry/fallback provider (CHA-230 Phase 2 — si streaming a dû basculer).
    const [retryFallback] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(chatConversationEvent)
      .where(
        and(
          eq(chatConversationEvent.type, 'chat_provider_retry_or_fallback'),
          gte(chatConversationEvent.occurredAt, start),
        ),
      );

    // Taux de capture = (submit + auto-created) / offered. Saturé à 100 %
    // pour rester lisible (si auto > offered, signe que le filet inline
    // joue à plein avant que l'utilisateur n'ait vu d'offre).
    const captures =
      (submitted?.n ?? 0) + (autoCreated?.n ?? 0);
    const captureRate =
      offered > 0
        ? Math.min(100, Math.round((captures / offered) * 1000) / 10)
        : 0;

    return {
      offered,
      submitted: submitted?.n ?? 0,
      autoCreated: autoCreated?.n ?? 0,
      dismissed: dismissed?.n ?? 0,
      captureRate,
      byReason,
      retryFallbackCount: retryFallback?.n ?? 0,
    };
  },

  /**
   * CHAT-055 — Compteurs Business du funnel + distribution d'intents.
   *
   * On reste sur des COUNT DISTINCT pour les paliers session-based (un
   * visiteur qui envoie 10 messages compte 1 fois pour `messagesUserSessions`).
   * Les conversions cumulent `chat_session.converted_at` et les leads
   * `outcome='converted'` (même règle que `overviewKpis`, sinon les deux
   * pages divergent).
   */
  async businessFunnel(window: KpiWindow = '30d') {
    const db = requireChatDb();
    const start = windowStart(window);

    const [sessions] = await db
      .select({ value: count() })
      .from(chatSession)
      .where(gte(chatSession.openedAt, start));

    const [messagesUserSessions] = await db
      .select({ value: sql<number>`COUNT(DISTINCT ${chatMessage.sessionId})` })
      .from(chatMessage)
      .innerJoin(chatSession, eq(chatSession.id, chatMessage.sessionId))
      .where(
        and(
          gte(chatSession.openedAt, start),
          eq(chatMessage.role, 'user'),
          eq(chatMessage.status, 'sent'),
        ),
      );

    const [leadsOffered] = await db
      .select({ value: sql<number>`COUNT(DISTINCT ${chatConversationEvent.sessionId})` })
      .from(chatConversationEvent)
      .where(
        and(
          gte(chatConversationEvent.occurredAt, start),
          eq(chatConversationEvent.type, 'chat_lead_form_offered'),
        ),
      );

    const [leadsSubmitted] = await db
      .select({ value: count() })
      .from(chatLead)
      .where(gte(chatLead.createdAt, start));

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

    // Distribution d'intents : on agrège sur `chat_lead.intent_at_capture`
    // (les seuls intents qui valent vraiment quelque chose côté Business :
    // un visiteur qui a déclenché un lead). NULL est groupé sous 'unknown'.
    const intentRows = await db
      .select({
        intent: sql<string>`COALESCE(${chatLead.intentAtCapture}, 'unknown')`,
        value: count(),
      })
      .from(chatLead)
      .where(gte(chatLead.createdAt, start))
      .groupBy(sql`COALESCE(${chatLead.intentAtCapture}, 'unknown')`);

    const intentCounts: Record<string, number> = {};
    for (const row of intentRows) {
      intentCounts[row.intent] = Number(row.value ?? 0);
    }

    return {
      window,
      counts: {
        sessions: Number(sessions?.value ?? 0),
        messagesUserSessions: Number(messagesUserSessions?.value ?? 0),
        leadsOffered: Number(leadsOffered?.value ?? 0),
        leadsSubmitted: Number(leadsSubmitted?.value ?? 0),
        conversions: Number(conversions?.value ?? 0),
      },
      intentCounts,
    };
  },

  /**
   * CHAT-055 — Vue Editorial (Yasmine) : matériel à publier + matériel à
   * rafraîchir. On sépare les deux pour un rendu en deux tables claires.
   *
   * - reviewCannedPairs : paires `status='review'` (ou 'draft') prêtes à
   *   être validées et publiées. Tri par `updatedAt` desc = ce qui bouge.
   * - staleFaqEntries : entries `enabled=true` non touchées depuis 90 j.
   *   Proxy au "feedback < 0 ou sim baisse 7j" du doc, faute de tracking
   *   FAQ→feedback aujourd'hui (chat_feedback est lié à message_id, pas
   *   à faq_entry).
   */
  /**
   * CHAT-066 — Données brutes pour le dashboard Care (`/admin/chat/care`).
   *
   * Retourne tous les leads `pending` (toutes triggers — le builder pur
   * filtre les triggers hot) + les événements `frustration_detected` sur
   * 7 jours (avec `sessionId` + `occurredAt`, suffisant pour le summary).
   *
   * On limite chaque liste à 200 lignes — au-delà l'utilisateur ira
   * directement dans `/admin/chat/leads` ou `/admin/chat/conversations`
   * pour filtrer / paginer.
   */
  async careOverview(opts: {
    limit?: number;
    /** CHA-LEAD-V2 — Default ['chat_widget', 'inline']. */
    sources?: ReadonlyArray<ChatLeadRow['source']>;
  } = {}): Promise<{
    pendingLeads: ChatLeadRow[];
    frustrationEvents: Array<{ sessionId: string; occurredAt: Date }>;
  }> {
    const db = requireChatDb();
    const limit = opts.limit ?? 200;
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sourceCond = buildSourceFilter(opts.sources);

    const pendingConds: ReturnType<typeof eq>[] = [eq(chatLead.outcome, 'pending')];
    if (sourceCond) pendingConds.push(sourceCond);

    const pendingLeads = await db
      .select()
      .from(chatLead)
      .where(and(...pendingConds))
      .orderBy(desc(chatLead.createdAt))
      .limit(limit);

    const frustrationRows = await db
      .select({
        sessionId: chatConversationEvent.sessionId,
        occurredAt: chatConversationEvent.occurredAt,
      })
      .from(chatConversationEvent)
      .where(
        and(
          eq(chatConversationEvent.type, 'frustration_detected'),
          gte(chatConversationEvent.occurredAt, since7d),
        ),
      )
      .orderBy(desc(chatConversationEvent.occurredAt))
      .limit(limit);

    return { pendingLeads, frustrationEvents: frustrationRows };
  },

  async editorialOverview(opts: { staleAfterDays?: number; limit?: number } = {}): Promise<{
    reviewCannedPairs: ChatCannedPairRow[];
    staleFaqEntries: ChatFaqEntryRow[];
    staleAfter: Date;
  }> {
    const db = requireChatDb();
    const limit = opts.limit ?? 50;
    const staleAfterDays = opts.staleAfterDays ?? 90;
    const staleAfter = new Date(Date.now() - staleAfterDays * 24 * 60 * 60 * 1000);

    const reviewCannedPairs = await db
      .select()
      .from(chatCannedPair)
      .where(inArray(chatCannedPair.status, ['review', 'draft']))
      .orderBy(desc(chatCannedPair.updatedAt))
      .limit(limit);

    const staleFaqEntries = await db
      .select()
      .from(chatFaqEntry)
      .where(
        and(eq(chatFaqEntry.enabled, true), lt(chatFaqEntry.updatedAt, staleAfter)),
      )
      .orderBy(chatFaqEntry.updatedAt)
      .limit(limit);

    return { reviewCannedPairs, staleFaqEntries, staleAfter };
  },
};
