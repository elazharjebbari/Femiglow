# 02 — Couche data

> *Schéma Drizzle (`chat_*`), migrations, indexes, retention, vector store*

---

## 1. Vue d'ensemble du schéma

```
chat_session ────┬──── chat_message ───── chat_feedback
                 │
                 ├──── chat_conversation_event
                 │
                 └──── (attribution) commande / kit

chat_knowledge_source ─┬─ chat_knowledge_chunk ─ chat_knowledge_embedding
                       │
                       └─ revisions (history append-only)

chat_provider_config (clés chiffrées)
chat_instruction_version (immutable, versionné)
chat_theme_preset (CSS tokens overrides)
chat_rate_limit_bucket (TTL court)
```

## 2. Tables principales

Les schémas Drizzle vivent dans `apps/web/src/lib/chat/db/schema.ts`.
Toutes les tables utilisent les conventions FemiGlow (préfixe id,
timestamps `created_at`, `updated_at`, `deleted_at` nullable).

### 2.1 `chat_session`

```ts
export const chatSession = pgTable(
  'chat_session',
  {
    id: text('id').primaryKey(),                    // cs_xxxxxxxx
    visitorId: text('visitor_id').notNull(),        // cookie persistant non-PII
    fingerprintHash: text('fingerprint_hash'),      // pour anti-abuse (sans IP)
    language: text('language').notNull().default('fr'),
    page: text('page'),                             // dernière page ouvrante (`/kit`, `/journal/...`)
    referrer: text('referrer'),
    utm: jsonb('utm').$type<Record<string, string>>(),
    instructionVersionId: text('instruction_version_id')
      .notNull()
      .references(() => chatInstructionVersion.id),
    themePresetId: text('theme_preset_id').references(() => chatThemePreset.id),
    experimentVariantId: text('experiment_variant_id'), // null si hors test
    status: text('status', { enum: ['open', 'idle', 'archived', 'purged'] })
      .notNull()
      .default('open'),
    openedAt: timestamp('opened_at').notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
    archivedAt: timestamp('archived_at'),
    purgedAt: timestamp('purged_at'),
    consent: jsonb('consent').$type<{
      essential: true;
      analytics: boolean;
      marketing: boolean;
    }>(),
    convertedOrderId: text('converted_order_id'), // attribution
    convertedAt: timestamp('converted_at'),
    metaSummary: text('meta_summary'),            // résumé LLM 200 caractères max
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    visitorIdx: index('chat_session_visitor_idx').on(t.visitorId),
    statusIdx: index('chat_session_status_idx').on(t.status, t.lastSeenAt),
    convIdx: index('chat_session_conv_idx').on(t.convertedAt),
    pageIdx: index('chat_session_page_idx').on(t.page),
  }),
);
```

### 2.2 `chat_message`

```ts
export const chatMessage = pgTable(
  'chat_message',
  {
    id: text('id').primaryKey(),                                    // cm_xxxxxxxx
    sessionId: text('session_id')
      .notNull()
      .references(() => chatSession.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system', 'tool'] }).notNull(),
    content: text('content').notNull(),                             // texte rendu (post-modération)
    contentRaw: text('content_raw'),                                // texte brut visiteur (pré-redact)
    contentSafe: text('content_safe'),                              // texte LLM-clean PII redacted
    language: text('language'),                                     // détecté
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    latencyMs: integer('latency_ms'),
    firstTokenMs: integer('first_token_ms'),
    providerId: text('provider_id').references(() => chatProviderConfig.id),
    modelName: text('model_name'),
    ragHits: jsonb('rag_hits').$type<Array<{ chunkId: string; score: number }>>(),
    moderation: jsonb('moderation').$type<{
      input?: { flagged: boolean; categories: string[] };
      output?: { flagged: boolean; rewritten: boolean };
    }>(),
    cost: numeric('cost', { precision: 10, scale: 6 }),             // EUR
    status: text('status', { enum: ['pending', 'streaming', 'sent', 'error', 'deleted'] })
      .notNull()
      .default('sent'),
    errorCode: text('error_code'),
    parentMessageId: text('parent_message_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    sessionCreatedIdx: index('chat_message_session_created_idx').on(t.sessionId, t.createdAt),
    fulltextIdx: index('chat_message_fulltext_idx').using('gin', sql`to_tsvector('simple', ${t.content})`),
    statusIdx: index('chat_message_status_idx').on(t.status),
  }),
);
```

> Le `tsvector` GIN supporte la recherche plein texte. La langue
> `simple` est volontaire : on indexe `fr`, `ar` et la darija
> latinisée éventuelle dans le même index. Si la volumétrie le
> justifie, on segmentera plus tard en index par langue.

### 2.3 `chat_knowledge_source`

```ts
export const chatKnowledgeSource = pgTable(
  'chat_knowledge_source',
  {
    id: text('id').primaryKey(),                                    // ck_xxxxxxxx
    kind: text('kind', { enum: ['url', 'markdown', 'pdf', 'docx', 'faq', 'snippet'] }).notNull(),
    label: text('label').notNull(),
    locator: text('locator'),                                       // URL ou clé blob
    blobUrl: text('blob_url'),
    rawHash: text('raw_hash').notNull(),                            // SHA-256 du contenu source
    language: text('language').notNull().default('fr'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    audience: text('audience', { enum: ['public', 'b2b', 'all'] }).notNull().default('all'),
    freshness: text('freshness', { enum: ['evergreen', 'seasonal', 'volatile'] })
      .notNull()
      .default('evergreen'),
    enabled: boolean('enabled').notNull().default(true),
    lastIngestedAt: timestamp('last_ingested_at'),
    chunkCount: integer('chunk_count').notNull().default(0),
    createdBy: text('created_by').notNull(),                        // admin user id
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    enabledIdx: index('chat_ks_enabled_idx').on(t.enabled, t.language),
    hashIdx: uniqueIndex('chat_ks_hash_idx').on(t.rawHash, t.language),
  }),
);
```

### 2.4 `chat_knowledge_chunk` + `chat_knowledge_embedding`

```ts
export const chatKnowledgeChunk = pgTable(
  'chat_knowledge_chunk',
  {
    id: text('id').primaryKey(),                                    // kc_xxxxxxxx
    sourceId: text('source_id').notNull().references(() => chatKnowledgeSource.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),                    // SHA-256 du chunk
    tokens: integer('tokens').notNull(),
    metadata: jsonb('metadata').$type<{
      heading?: string;
      url?: string;
      anchor?: string;
      page?: number;
      lastUpdatedAt?: string;
    }>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    sourceOrdIdx: uniqueIndex('chat_kc_source_ord_idx').on(t.sourceId, t.ordinal),
    hashIdx: index('chat_kc_hash_idx').on(t.contentHash),
  }),
);

export const chatKnowledgeEmbedding = pgTable(
  'chat_knowledge_embedding',
  {
    id: text('id').primaryKey(),                                    // ke_xxxxxxxx
    chunkId: text('chunk_id').notNull().references(() => chatKnowledgeChunk.id, { onDelete: 'cascade' }),
    embedderProvider: text('embedder_provider').notNull(),          // 'openai'
    embedderModel: text('embedder_model').notNull(),                // 'text-embedding-3-small'
    dim: integer('dim').notNull(),                                  // ex. 1536
    vector: customVector('vector', { dimensions: 1536 }).notNull(), // pgvector
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    chunkUniqIdx: uniqueIndex('chat_ke_chunk_uniq_idx').on(t.chunkId, t.embedderModel),
    hnsw: index('chat_ke_hnsw_idx').using('hnsw', t.vector.op('vector_cosine_ops')),
  }),
);
```

> `customVector` est un type custom Drizzle qui mappe `vector(N)`
> de pgvector. `pnpm db:push` requiert `CREATE EXTENSION IF NOT EXISTS vector;`
> dans `drizzle/0001_init_chat.sql`.

### 2.5 `chat_provider_config`

```ts
export const chatProviderConfig = pgTable(
  'chat_provider_config',
  {
    id: text('id').primaryKey(),                                    // cp_xxxxxxxx
    kind: text('kind', { enum: ['openai', 'gemini', 'anthropic', 'mistral', 'qwen', 'deepseek', 'zhipu', 'ollama', 'azure-openai'] }).notNull(),
    label: text('label').notNull(),
    priority: integer('priority').notNull().default(100),           // plus bas = plus prioritaire
    enabled: boolean('enabled').notNull().default(true),
    role: text('role', { enum: ['chat', 'embedding', 'moderation', 'rerank'] }).notNull(),
    chatModel: text('chat_model'),
    embeddingModel: text('embedding_model'),
    moderationModel: text('moderation_model'),
    apiBase: text('api_base'),                                      // override (Azure, Ollama)
    apiKeyEncrypted: text('api_key_encrypted'),                     // AES-GCM, base64
    apiKeyIv: text('api_key_iv'),
    headers: jsonb('headers').$type<Record<string, string>>(),
    parameters: jsonb('parameters').$type<{
      temperature?: number;
      topP?: number;
      maxTokens?: number;
      timeoutMs?: number;
    }>(),
    quotaMonthlyEur: numeric('quota_monthly_eur', { precision: 10, scale: 2 }),
    consumedMonthEur: numeric('consumed_month_eur', { precision: 10, scale: 6 }).notNull().default('0'),
    consumedResetAt: timestamp('consumed_reset_at').notNull().defaultNow(),
    egressAllowed: boolean('egress_allowed').notNull().default(false), // opt-in envoi PII
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    rolePriorityIdx: index('chat_pc_role_priority_idx').on(t.role, t.priority, t.enabled),
  }),
);
```

### 2.6 `chat_instruction_version`

Versionné, **immutable**. Chaque édition crée une nouvelle ligne.

```ts
export const chatInstructionVersion = pgTable(
  'chat_instruction_version',
  {
    id: text('id').primaryKey(),                                    // ci_xxxxxxxx
    version: integer('version').notNull(),                          // monotone par scope
    scope: text('scope').notNull().default('default'),              // possibilité de plusieurs personae
    body: text('body').notNull(),                                   // prompt système (FR par défaut)
    bodyAr: text('body_ar'),
    bodyArMa: text('body_ar_ma'),
    notes: text('notes'),                                           // changelog éditeur
    enabled: boolean('enabled').notNull().default(false),           // un seul actif par scope
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    scopeVersionIdx: uniqueIndex('chat_iv_scope_version_idx').on(t.scope, t.version),
    activeIdx: uniqueIndex('chat_iv_active_idx').on(t.scope).where(sql`enabled = true`),
  }),
);
```

### 2.7 `chat_theme_preset`

```ts
export const chatThemePreset = pgTable(
  'chat_theme_preset',
  {
    id: text('id').primaryKey(),                                    // ct_xxxxxxxx
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    tokens: jsonb('tokens').$type<ThemeTokens>().notNull(),         // cf. doc 05
    layout: jsonb('layout').$type<ThemeLayout>().notNull(),         // position, taille, breakpoints
    motion: jsonb('motion').$type<ThemeMotion>().notNull(),         // durées, easings
    pageSalutations: jsonb('page_salutations').$type<Array<{
      pathPattern: string;
      fr: string;
      ar?: string;
      arMa?: string;
      timeWindow?: 'morning' | 'afternoon' | 'evening';
    }>>(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
);
```

### 2.8 `chat_conversation_event`

Source de vérité KPI. Append-only, indexée pour agrégation.

```ts
export const chatConversationEvent = pgTable(
  'chat_conversation_event',
  {
    id: text('id').primaryKey(),                                    // cv_xxxxxxxx
    sessionId: text('session_id').notNull(),
    type: text('type', {
      enum: [
        'session_open', 'widget_open', 'widget_close',
        'message_sent_user', 'message_sent_agent',
        'feedback_positive', 'feedback_negative',
        'suggestion_clicked', 'language_switch',
        'error', 'rate_limit_hit',
        'conversion_attributed', 'lead_email_captured',
      ],
    }).notNull(),
    payload: jsonb('payload'),
    occurredAt: timestamp('occurred_at').notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index('chat_ce_session_idx').on(t.sessionId, t.occurredAt),
    typeOccurredIdx: index('chat_ce_type_occurred_idx').on(t.type, t.occurredAt),
  }),
);
```

### 2.9 `chat_feedback`

```ts
export const chatFeedback = pgTable(
  'chat_feedback',
  {
    id: text('id').primaryKey(),                                    // cf_xxxxxxxx
    messageId: text('message_id').notNull().references(() => chatMessage.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    value: integer('value').notNull(),                              // -1 | 1
    note: text('note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    messageUniqIdx: uniqueIndex('chat_fb_message_uniq_idx').on(t.messageId),
  }),
);
```

### 2.10 `chat_rate_limit_bucket`

TTL court (15 min). Purge automatique par tâche cron quotidienne.

```ts
export const chatRateLimitBucket = pgTable(
  'chat_rate_limit_bucket',
  {
    id: text('id').primaryKey(),                                    // cr_xxxxxxxx
    scope: text('scope', { enum: ['ip', 'session', 'visitor'] }).notNull(),
    key: text('key').notNull(),                                     // hash IP / sessionId / visitorId
    windowStart: timestamp('window_start').notNull(),
    count: integer('count').notNull().default(0),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (t) => ({
    scopeKeyIdx: uniqueIndex('chat_rl_scope_key_idx').on(t.scope, t.key, t.windowStart),
    expIdx: index('chat_rl_exp_idx').on(t.expiresAt),
  }),
);
```

## 3. Indexes critiques

| Index                                   | Bénéfice                                                                |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `chat_message_session_created_idx`      | Affichage chronologique d'une conversation                              |
| `chat_message_fulltext_idx` (GIN)       | Recherche plein texte admin                                             |
| `chat_session_conv_idx`                 | Comptage des conversions sur fenêtre temporelle                         |
| `chat_ce_type_occurred_idx`             | Agrégation KPIs par type sur fenêtre                                    |
| `chat_ke_hnsw_idx`                      | Recherche vectorielle top-k rapide (HNSW cosine)                        |
| `chat_pc_role_priority_idx`             | Sélection rapide du provider primaire actif                             |

## 4. Vues SQL et matérialisations

### 4.1 Vue `chat_kpi_window` (matérialisée, refresh 5 min)

Pré-calcule les agrégats par fenêtre `today / yesterday / 7d / 30d / 90d / all`
pour réponses < 200 ms côté admin.

```sql
CREATE MATERIALIZED VIEW chat_kpi_window AS
SELECT
  window_label,
  COUNT(DISTINCT s.id)                                               AS sessions,
  COUNT(DISTINCT s.id) FILTER (WHERE m.user_messages > 0)            AS engaged_sessions,
  COUNT(DISTINCT s.id) FILTER (WHERE s.converted_at IS NOT NULL)     AS converted_sessions,
  AVG(m.user_messages + m.agent_messages)                            AS avg_messages,
  AVG(EXTRACT(EPOCH FROM (s.last_seen_at - s.opened_at)))            AS avg_duration_sec,
  AVG(m.first_token_ms)                                              AS avg_first_token_ms
FROM (
  VALUES
    ('today',     NOW()::date),
    ('yesterday', NOW()::date - INTERVAL '1 day'),
    ('7d',        NOW() - INTERVAL '7 days'),
    ('30d',       NOW() - INTERVAL '30 days'),
    ('90d',       NOW() - INTERVAL '90 days'),
    ('all',       'epoch'::timestamp)
) AS w(window_label, since)
JOIN chat_session s ON s.opened_at >= w.since
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE role = 'user')      AS user_messages,
    COUNT(*) FILTER (WHERE role = 'assistant') AS agent_messages,
    AVG(first_token_ms) FILTER (WHERE role = 'assistant') AS first_token_ms
  FROM chat_message
  WHERE session_id = s.id
) m ON TRUE
GROUP BY window_label;
```

> Refresh par tâche cron Vercel `*/5 * * * *` ou via
> `chat_conversation_event` trigger.

### 4.2 Vue `chat_session_summary`

Vue normale agrégée pour la liste admin (pas matérialisée car
la liste est paginée et filtrable).

## 5. Migrations Drizzle

```
drizzle/
  0011_chat_init.sql            # extensions + tables
  0012_chat_indexes.sql
  0013_chat_kpi_view.sql
  0014_chat_seed_default_theme.sql
  0015_chat_seed_default_instruction.sql
```

`0011_chat_init.sql` (extrait) :

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chat_session ( ... );
CREATE TABLE chat_message ( ... );
-- ...
```

## 6. Retention et purge

| Table                       | Conservation | Action après expiration            |
| --------------------------- | ------------ | ---------------------------------- |
| `chat_session`              | 30 jours actifs, 12 mois archivés | Anonymisation visiteur, conservation des KPIs |
| `chat_message`              | 12 mois      | Purge des `content_raw`, conservation `content_safe` jusqu'à 24 mois pour audit qualité |
| `chat_conversation_event`   | 24 mois      | Agrégation puis purge fine         |
| `chat_feedback`             | 24 mois      | Conservation                       |
| `chat_rate_limit_bucket`    | 24 h         | Purge automatique                  |
| `chat_knowledge_*`          | tant que la source est active | Reindex sur changement de hash, suppression sur désactivation source |

Les purges sont déclenchées par une tâche cron Vercel quotidienne
(`POST /api/admin/chat/maintenance/purge`, cf. doc 03).

## 7. Droit à l'oubli (RGPD)

Endpoint `POST /api/admin/chat/sessions/:id/forget` :

```sql
BEGIN;
UPDATE chat_message
   SET content = '[supprimé]', content_raw = NULL, content_safe = NULL
 WHERE session_id = :id;
UPDATE chat_session
   SET status = 'purged', purged_at = NOW(),
       visitor_id = encode(gen_random_bytes(16), 'hex'),
       fingerprint_hash = NULL,
       referrer = NULL,
       utm = NULL,
       meta_summary = NULL
 WHERE id = :id;
DELETE FROM chat_feedback WHERE session_id = :id;
COMMIT;
```

L'audit log de la modération conserve un hash anonyme pour
défense légale (max 13 mois).

## 8. Volumétrie cible

| Hypothèse                            | V1 (3 mois)    | Notes                             |
| ------------------------------------ | -------------- | --------------------------------- |
| Sessions / mois                      | 8 000          | 100 k visiteurs × 8 % ouvertures  |
| Messages / session médiane           | 4              |                                   |
| Messages / mois                      | 32 000         |                                   |
| Chunks de connaissance               | 2 500          | Site + journal + FAQ              |
| Embeddings (1536 dim)                | 2 500 × 6 ko = 15 Mo |                              |
| Volume total Postgres                | < 2 Go         | Confortable Neon Free / Pro       |

## 9. Performance attendue

| Requête                                                      | Temps cible (p95) |
| ------------------------------------------------------------ | ----------------- |
| `getMessagesBySession(sessionId, limit=50)`                  | < 20 ms           |
| `searchMessagesFulltext(q, filters)` sur 30 j                | < 600 ms          |
| `kpiWindow('30d')` (vue matérialisée)                        | < 30 ms           |
| `vectorSearch(embedding, k=6)` sur 10 k chunks               | < 80 ms           |
| `attributeConversion(orderId, sessionId)`                    | < 50 ms           |

## 10. Lecture suivante

- [03 — Backend](03-backend.md) pour les services et routes.
- [09 — Base de connaissance & RAG](09-knowledge-base-rag.md) pour
  l'ingestion et le retrieval.
- [13 — Sécurité, RGPD & modération](13-securite-rgpd-moderation.md)
  pour la PII et le droit à l'oubli.
