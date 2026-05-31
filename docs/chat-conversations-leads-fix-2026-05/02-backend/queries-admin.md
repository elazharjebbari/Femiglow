# Queries admin — code complet modifié

> Code complet TypeScript à intégrer dans `apps/web/src/lib/chat/admin/queries.ts`.
> Toutes les queries sont protégées par le feature flag `CHAT_ADMIN_FILTERS_V2`.

## 1. Imports nécessaires (en tête de fichier)

```diff
 import { and, count, desc, eq, gte, inArray, isNotNull, lt, lte, or, sql } from 'drizzle-orm';

 import { rowsOf } from '@/lib/db/exec';

 import { requireChatDb } from '../db/client';
 import {
   chatCannedPair,
   chatConversationEvent,
   chatFaqEntry,
   chatFeedback,
   chatKnowledgeSource,
   chatLead,
   chatMessage,
   chatProviderConfig,
   chatSession,
   chatThemePreset,
   type ChatCannedPairRow,
   type ChatFaqEntryRow,
   type ChatLeadRow,
   type ChatSessionRow,
 } from '../db/schema';
+import {
+  ADMIN_CHAT_VISIBLE_KINDS,
+  ADMIN_CHAT_VISIBLE_LEAD_SOURCES,
+  type ChatSessionKind,
+} from '../db/kind';
+import { isChatAdminFiltersV2Enabled } from '../feature-flag';
```

## 2. Helper interne — applique filtre `kind`

```ts
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
```

## 3. `listConversations` — version finale

```ts
async listConversations(opts: {
  q?: string;
  language?: string;
  status?: ChatSessionRow['status'];
  fromDate?: Date;
  toDate?: Date;
  converted?: 'yes' | 'no';
  /** CHA-LEAD-V2 — Filtre kind (default ['chat']). */
  kinds?: ReadonlyArray<ChatSessionKind>;
  /** CHA-LEAD-V2 — Exclut les sessions sans message user (default true). */
  withMessagesOnly?: boolean;
  limit?: number;
}): Promise<ChatSessionRow[]> {
  const db = requireChatDb();
  const limit = opts.limit ?? 50;
  const withMessagesOnly = opts.withMessagesOnly ?? true;

  // Pré-calcule converted set
  let convertedIdsFilter: { ids: Set<string> } | null = null;
  if (opts.converted) {
    const ids = await this.convertedSessionIds({
      fromDate: opts.fromDate,
      toDate: opts.toDate,
      kinds: opts.kinds,
    });
    convertedIdsFilter = { ids: new Set(ids) };
  }

  // Path full-text search
  if (opts.q && opts.q.trim().length > 0) {
    const kindCond = isChatAdminFiltersV2Enabled()
      ? sql`AND s.kind = ANY(ARRAY[${sql.join(
          (opts.kinds ?? ADMIN_CHAT_VISIBLE_KINDS).map((k) => sql`${k}`),
          sql`, `,
        )}]::text[])`
      : sql``;
    const rows = await db.execute<ChatSessionRow>(sql`
      SELECT s.*
        FROM chat_session s
        JOIN (
               SELECT DISTINCT session_id
                 FROM chat_message
                WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', ${opts.q})
             ) m ON m.session_id = s.id
       WHERE 1=1 ${kindCond}
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

  // Path query builder normal
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
      conds.push(sql`${chatSession.id} NOT IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
    }
  }

  return db
    .select()
    .from(chatSession)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(chatSession.lastSeenAt))
    .limit(limit);
}
```

## 4. `listChatLeads` — version finale

```ts
async listChatLeads(opts: {
  outcome?: ChatLeadRow['outcome'];
  triggerReason?: ChatLeadRow['triggerReason'];
  fromDate?: Date;
  toDate?: Date;
  /** CHA-LEAD-V2 — Filtre source (default ['chat_widget', 'inline']). */
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
}
```

## 5. `convertedSessionIds` — version finale

```ts
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

  // Lead-based conversions, mais on filtre les leads source chat_widget/inline
  // (sinon un wizard_kit converted polluerait ici)
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
}
```

## 6. `overviewKpis` — version finale (extraits clés)

```ts
async overviewKpis(
  window: KpiWindow = '7d',
  opts: { kinds?: ReadonlyArray<ChatSessionKind> } = {},
) {
  const db = requireChatDb();
  const start = windowStart(window);

  // Filtre kind appliqué partout
  const kindCond = buildKindFilter(opts.kinds);

  const [sessions] = await db
    .select({ value: count() })
    .from(chatSession)
    .where(and(gte(chatSession.openedAt, start), kindCond));

  const [messagesUser] = await db
    .select({ value: count() })
    .from(chatMessage)
    .innerJoin(chatSession, eq(chatSession.id, chatMessage.sessionId))
    .where(
      and(
        eq(chatMessage.role, 'user'),
        gte(chatMessage.createdAt, start),
        eq(chatMessage.status, 'sent'),
        kindCond,
      ),
    );

  // ... same logic pour messagesAgent, conversions, leadsCaptured, leadsConverted ...
  // En particulier pour leadsCaptured :
  const sourceCond = buildSourceFilter();
  const [leadsCaptured] = await db
    .select({ value: count() })
    .from(chatLead)
    .where(and(gte(chatLead.createdAt, start), sourceCond));

  const [leadsConverted] = await db
    .select({ value: count() })
    .from(chatLead)
    .where(and(
      gte(chatLead.createdAt, start),
      eq(chatLead.outcome, 'converted'),
      sourceCond,
    ));

  // ... reste inchangé ...
}
```

## 7. `businessFunnel` — version finale (extraits clés)

```ts
async businessFunnel(
  window: KpiWindow = '30d',
  opts: { kinds?: ReadonlyArray<ChatSessionKind> } = {},
) {
  const db = requireChatDb();
  const start = windowStart(window);
  const kindCond = buildKindFilter(opts.kinds);
  const sourceCond = buildSourceFilter();

  const [sessions] = await db
    .select({ value: count() })
    .from(chatSession)
    .where(and(gte(chatSession.openedAt, start), kindCond));

  const [messagesUserSessions] = await db
    .select({ value: sql<number>`COUNT(DISTINCT ${chatMessage.sessionId})` })
    .from(chatMessage)
    .innerJoin(chatSession, eq(chatSession.id, chatMessage.sessionId))
    .where(
      and(
        gte(chatSession.openedAt, start),
        eq(chatMessage.role, 'user'),
        eq(chatMessage.status, 'sent'),
        kindCond,
      ),
    );

  // leadsOffered = events `chat_lead_form_offered` — ils proviennent du widget chat,
  // donc on filtre les sessions kind='chat' uniquement
  const [leadsOffered] = await db
    .select({ value: sql<number>`COUNT(DISTINCT ${chatConversationEvent.sessionId})` })
    .from(chatConversationEvent)
    .innerJoin(chatSession, eq(chatSession.id, chatConversationEvent.sessionId))
    .where(
      and(
        gte(chatConversationEvent.occurredAt, start),
        eq(chatConversationEvent.type, 'chat_lead_form_offered'),
        kindCond,
      ),
    );

  // leadsSubmitted = chat_lead avec source chat_widget / inline
  const [leadsSubmitted] = await db
    .select({ value: count() })
    .from(chatLead)
    .where(and(gte(chatLead.createdAt, start), sourceCond));

  // ... reste similaire ...
}
```

## 8. `careOverview` — version finale

```ts
async careOverview(opts: {
  limit?: number;
  sources?: ReadonlyArray<ChatLeadRow['source']>;
} = {}): Promise<{
  pendingLeads: ChatLeadRow[];
  frustrationEvents: Array<{ sessionId: string; occurredAt: Date }>;
}> {
  const db = requireChatDb();
  const limit = opts.limit ?? 200;
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sourceCond = buildSourceFilter(opts.sources);
  const kindCond = buildKindFilter();

  const pendingLeads = await db
    .select()
    .from(chatLead)
    .where(and(eq(chatLead.outcome, 'pending'), sourceCond))
    .orderBy(desc(chatLead.createdAt))
    .limit(limit);

  // Frustration events viennent du widget chat, donc on filtre sur kind='chat'
  const frustrationRows = await db
    .select({
      sessionId: chatConversationEvent.sessionId,
      occurredAt: chatConversationEvent.occurredAt,
    })
    .from(chatConversationEvent)
    .innerJoin(chatSession, eq(chatSession.id, chatConversationEvent.sessionId))
    .where(
      and(
        eq(chatConversationEvent.type, 'frustration_detected'),
        gte(chatConversationEvent.occurredAt, since7d),
        kindCond,
      ),
    )
    .orderBy(desc(chatConversationEvent.occurredAt))
    .limit(limit);

  return { pendingLeads, frustrationEvents: frustrationRows };
}
```

## 9. Logique de cleanup (consommé par l'endpoint)

**Fichier nouveau** : `apps/web/src/lib/chat/admin/cleanup.ts`

```ts
/**
 * CHA-LEAD-V2 — Cleanup des ghost sessions orphelines.
 *
 * Archive les rows `chat_session` :
 *  - kind = 'wizard_pivot'
 *  - status = 'open'
 *  - aucun `chat_lead` rattaché
 *  - opened_at > N jours
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/01-design-conception/api-contracts.md §9
 */
import { and, eq, lt, notExists, sql } from 'drizzle-orm';

import { requireChatDb } from '../db/client';
import { chatLead, chatSession } from '../db/schema';
import type { ChatSessionKind } from '../db/kind';

export interface CleanupGhostsInput {
  dryRun: boolean;
  olderThanDays: number;
  kinds?: ReadonlyArray<ChatSessionKind>;
}

export interface CleanupGhostsResult {
  candidates: number;
  archived: number;
  dryRun: boolean;
  criteria: {
    olderThanDays: number;
    kinds: ReadonlyArray<ChatSessionKind>;
    withoutLead: true;
  };
}

const DEFAULT_KINDS: ReadonlyArray<ChatSessionKind> = ['wizard_pivot'];

export async function cleanupGhosts(
  input: CleanupGhostsInput,
): Promise<CleanupGhostsResult> {
  if (input.olderThanDays < 7) {
    throw new Error('olderThanDays must be >= 7 (safety guard)');
  }
  const db = requireChatDb();
  const kinds = input.kinds && input.kinds.length > 0 ? input.kinds : DEFAULT_KINDS;
  const cutoff = new Date(Date.now() - input.olderThanDays * 24 * 60 * 60 * 1000);

  // 1. Compter les candidats
  const [{ value: candidates }] = await db
    .select({ value: sql<number>`COUNT(*)` })
    .from(chatSession)
    .where(
      and(
        sql`${chatSession.kind} IN (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})`,
        eq(chatSession.status, 'open'),
        lt(chatSession.openedAt, cutoff),
        notExists(
          db.select().from(chatLead).where(eq(chatLead.sessionId, chatSession.id)),
        ),
      ),
    );

  // 2. Archiver si pas dry-run
  let archived = 0;
  if (!input.dryRun && Number(candidates) > 0) {
    const result = await db
      .update(chatSession)
      .set({
        status: 'archived',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          sql`${chatSession.kind} IN (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})`,
          eq(chatSession.status, 'open'),
          lt(chatSession.openedAt, cutoff),
          notExists(
            db.select().from(chatLead).where(eq(chatLead.sessionId, chatSession.id)),
          ),
        ),
      )
      .returning({ id: chatSession.id });
    archived = result.length;
  }

  return {
    candidates: Number(candidates),
    archived,
    dryRun: input.dryRun,
    criteria: {
      olderThanDays: input.olderThanDays,
      kinds,
      withoutLead: true,
    },
  };
}
```

## 10. Vérifications post-implémentation

```bash
# 1. Vérifier que les types compilent
pnpm typecheck 2>&1 | grep "src/lib/chat/admin/queries"

# 2. Vérifier que la suite vitest passe (admin/queries.test.ts en particulier)
pnpm vitest run src/lib/chat/admin/queries.test.ts 2>&1 | tail -20

# 3. Smoke test query avec flag off
CHAT_ADMIN_FILTERS_V2=false pnpm tsx -e "
  const { adminQueries } = await import('./src/lib/chat/admin/queries');
  const rows = await adminQueries.listConversations({ limit: 5 });
  console.log('Flag OFF — rows:', rows.length);
"

# 4. Smoke test query avec flag on
CHAT_ADMIN_FILTERS_V2=true pnpm tsx -e "
  const { adminQueries } = await import('./src/lib/chat/admin/queries');
  const rows = await adminQueries.listConversations({ limit: 5 });
  console.log('Flag ON — rows:', rows.length);
"
```
