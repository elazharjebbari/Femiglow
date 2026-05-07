# 02 — Couche data

## 1. Vue d'ensemble

Sept tables nouvelles, toutes préfixées `tracking_*`, dans Postgres
Neon (driver `@neondatabase/serverless` via Drizzle), avec fallback
in-memory (pattern existant `db()` / `memoryStore()`).

| Table | Volume estimé / mois | Usage |
|---|---|---|
| `tracking_pages` | ~30 lignes (statique) | inventaire pages |
| `tracking_components` | ~120 lignes (statique) | inventaire composants |
| `tracking_event_definitions` | ~80 lignes (catalogue) | référentiel events |
| `tracking_component_events` | ~600 lignes | toggle event×composant |
| `tracking_providers` | 5 lignes (Meta, TikTok…) | pixels |
| `tracking_events_log` | 1–10 M / mois | log brut events |
| `tracking_consent_snapshots` | 100 K / mois | preuve consent |

## 2. Préfixes d'IDs

`createId()` (existant `src/lib/ids.ts`) avec préfixes :

- `tp_` : page
- `tc_` : composant
- `ted_` : event definition
- `tce_` : component-event mapping
- `tpr_` : provider
- `tev_` : event log entry
- `tcs_` : consent snapshot

## 3. Enums Drizzle

```ts
export const trackingComponentCategoryEnum = pgEnum('tracking_component_category', [
  'cta_primary',
  'cta_secondary',
  'cta_ghost',
  'navigation',
  'form_input',
  'form_submit',
  'media_image',
  'media_video',
  'media_audio',
  'list_item',
  'card',
  'pricing',
  'filter',
  'search',
  'social_share',
  'newsletter',
  'modal',
  'accordion',
  'tab',
  'carousel',
  'progress',
  'banner',
  'section_hero',
  'section_content',
  'section_testimonial',
  'section_faq',
  'commerce_cart',
  'commerce_checkout',
  'admin',
]);

export const trackingEventScopeEnum = pgEnum('tracking_event_scope', [
  'web',
  'server',
  'both',
]);

export const trackingEventCategoryEnum = pgEnum('tracking_event_category', [
  'page',
  'engagement',
  'ecommerce',
  'lead',
  'media',
  'admin',
  'custom',
]);

export const trackingProviderKindEnum = pgEnum('tracking_provider_kind', [
  'meta',
  'tiktok',
  'google_ads',
  'google_ga4',
  'snap',
  'pinterest',
  'gtm',
  'custom',
]);

export const trackingProviderStatusEnum = pgEnum('tracking_provider_status', [
  'disabled',
  'enabled',
  'error',
]);

export const trackingConsentStateEnum = pgEnum('tracking_consent_state', [
  'granted',
  'denied',
  'pending',
]);
```

## 4. Tables Drizzle

### 4.1 `tracking_pages`

```ts
export const trackingPages = pgTable('tracking_pages', {
  id: text('id').primaryKey(), // tp_xxx
  route: text('route').notNull().unique(), // /journal, /kit
  title: text('title').notNull(),
  category: text('category').notNull(), // landing | content | commerce | admin | dev
  enabled: boolean('enabled').notNull().default(true),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  idxRoute: index('idx_tracking_pages_route').on(t.route),
}));
```

### 4.2 `tracking_components`

```ts
export const trackingComponents = pgTable('tracking_components', {
  id: text('id').primaryKey(), // tc_xxx
  name: text('name').notNull(), // ex: HeroProduit
  path: text('path').notNull(), // src/components/sections/HeroProduit.tsx
  category: trackingComponentCategoryEnum('category').notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(false),
  defaultParams: jsonb('default_params').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  idxPath: uniqueIndex('idx_tracking_components_path').on(t.path),
  idxCategory: index('idx_tracking_components_category').on(t.category),
}));
```

### 4.3 `tracking_pages_components` (M:N)

```ts
export const trackingPagesComponents = pgTable('tracking_pages_components', {
  pageId: text('page_id').notNull().references(() => trackingPages.id, { onDelete: 'cascade' }),
  componentId: text('component_id').notNull().references(() => trackingComponents.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.pageId, t.componentId] }),
  idxPage: index('idx_tpc_page').on(t.pageId),
  idxComp: index('idx_tpc_comp').on(t.componentId),
}));
```

### 4.4 `tracking_event_definitions`

```ts
export const trackingEventDefinitions = pgTable('tracking_event_definitions', {
  id: text('id').primaryKey(), // ted_xxx
  name: text('name').notNull().unique(), // view_item, add_to_cart, fg_journal_read_75
  category: trackingEventCategoryEnum('category').notNull(),
  scope: trackingEventScopeEnum('scope').notNull().default('web'),
  description: text('description').notNull(),
  isConversion: boolean('is_conversion').notNull().default(false),
  paramsSchema: jsonb('params_schema').$type<JSONSchema>().notNull(), // JSON Schema (validé Zod runtime)
  applicableCategories: trackingComponentCategoryEnum('applicable_categories').array().notNull(),
  defaultProviders: text('default_providers').array().notNull().default([]), // ['meta', 'tiktok']
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  idxName: uniqueIndex('idx_tracking_event_def_name').on(t.name),
  idxCategory: index('idx_tracking_event_def_category').on(t.category),
}));
```

### 4.5 `tracking_component_events`

Mappage : pour ce composant, quels events sont actifs avec quels
paramètres et quels providers.

```ts
export const trackingComponentEvents = pgTable('tracking_component_events', {
  id: text('id').primaryKey(), // tce_xxx
  componentId: text('component_id').notNull().references(() => trackingComponents.id, { onDelete: 'cascade' }),
  eventDefinitionId: text('event_definition_id').notNull().references(() => trackingEventDefinitions.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  paramsOverride: jsonb('params_override').$type<Record<string, unknown>>().notNull().default({}),
  providersOverride: text('providers_override').array(), // null = use event default
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex('uniq_tce').on(t.componentId, t.eventDefinitionId),
  idxComp: index('idx_tce_comp').on(t.componentId),
}));
```

### 4.6 `tracking_providers`

```ts
export const trackingProviders = pgTable('tracking_providers', {
  id: text('id').primaryKey(), // tpr_xxx
  kind: trackingProviderKindEnum('kind').notNull().unique(),
  status: trackingProviderStatusEnum('status').notNull().default('disabled'),
  pixelId: text('pixel_id'), // FB Pixel ID, TikTok Pixel ID, …
  capiToken: text('capi_token'), // chiffré (cf webhooks pattern)
  capiTokenIv: text('capi_token_iv'),
  capiTokenTag: text('capi_token_tag'),
  testEventCode: text('test_event_code'), // Meta Test Events, TikTok test_event_code
  customHead: text('custom_head'), // injecté <head>
  customBody: text('custom_body'), // injecté avant </body>
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  lastEventAt: timestamp('last_event_at'),
  errorCount24h: integer('error_count_24h').notNull().default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  idxKind: uniqueIndex('idx_tpr_kind').on(t.kind),
}));
```

### 4.7 `tracking_events_log`

Hot table — partitionnée par mois (Phase 7) ou TTL via cron purge.

```ts
export const trackingEventsLog = pgTable('tracking_events_log', {
  id: text('id').primaryKey(), // tev_xxx (UUID v7 base32)
  eventId: text('event_id').notNull(),
  eventName: text('event_name').notNull(),
  eventCategory: trackingEventCategoryEnum('event_category').notNull(),
  pageId: text('page_id').references(() => trackingPages.id, { onDelete: 'set null' }),
  componentId: text('component_id').references(() => trackingComponents.id, { onDelete: 'set null' }),
  pageRoute: text('page_route').notNull(), // copie pour query rapide
  anonymousId: text('anonymous_id').notNull(),
  sessionId: text('session_id').notNull(),
  userId: text('user_id'), // si lead/admin identifié
  consentSnapshot: jsonb('consent_snapshot').$type<ConsentState>().notNull(),
  payload: jsonb('payload').$type<TrackingEventPayload>().notNull(),
  uaHash: text('ua_hash').notNull(),
  ipAnonymized: text('ip_anonymized').notNull(),
  device: text('device').notNull(), // mobile | tablet | desktop
  locale: text('locale').notNull(),
  isConversion: boolean('is_conversion').notNull().default(false),
  providersDispatched: text('providers_dispatched').array().notNull().default([]),
  providersResults: jsonb('providers_results').$type<Record<string, ProviderResult>>().notNull().default({}),
  receivedAt: timestamp('received_at').notNull().defaultNow(),
  schemaVersion: integer('schema_version').notNull().default(1),
}, (t) => ({
  uniqEventId: uniqueIndex('uniq_tev_event_id').on(t.eventId),
  idxName: index('idx_tev_event_name').on(t.eventName),
  idxReceivedAt: index('idx_tev_received_at').on(t.receivedAt),
  idxAnonymous: index('idx_tev_anonymous_id').on(t.anonymousId),
  idxSession: index('idx_tev_session_id').on(t.sessionId),
  idxConversion: index('idx_tev_conversion').on(t.isConversion).where(dsql`is_conversion = true`),
}));
```

### 4.8 `tracking_consent_snapshots`

Stocke un snapshot du consentement à chaque modification (pour audit
RGPD). Déduplication par `anonymousId + hash(state)` pour éviter de
spammer la table.

```ts
export const trackingConsentSnapshots = pgTable('tracking_consent_snapshots', {
  id: text('id').primaryKey(), // tcs_xxx
  anonymousId: text('anonymous_id').notNull(),
  state: jsonb('state').$type<ConsentState>().notNull(),
  stateHash: text('state_hash').notNull(),
  source: text('source').notNull(), // 'banner' | 'preferences' | 'api' | 'auto'
  ipAnonymized: text('ip_anonymized').notNull(),
  uaHash: text('ua_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  idxAnonymous: index('idx_tcs_anonymous').on(t.anonymousId),
  uniq: uniqueIndex('uniq_tcs_state').on(t.anonymousId, t.stateHash),
}));
```

## 5. Types TypeScript dérivés

```ts
export type TrackingPage = typeof trackingPages.$inferSelect;
export type TrackingComponent = typeof trackingComponents.$inferSelect;
export type TrackingEventDefinition = typeof trackingEventDefinitions.$inferSelect;
export type TrackingComponentEvent = typeof trackingComponentEvents.$inferSelect;
export type TrackingProvider = typeof trackingProviders.$inferSelect;
export type TrackingEventLogEntry = typeof trackingEventsLog.$inferSelect;
export type TrackingConsentSnapshot = typeof trackingConsentSnapshots.$inferSelect;

export interface ConsentState {
  ad_storage: 'granted' | 'denied';
  analytics_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
  functional_storage: 'granted' | 'denied';
}

export interface ProviderResult {
  status: 'ok' | 'error' | 'skipped';
  durationMs?: number;
  error?: string;
  responseCode?: number;
}
```

## 6. Migrations

`drizzle/0042_tracking_init.sql` (généré via
`pnpm db:generate`). Avant ajout dans CI :

- créer enums `tracking_*` avant tables.
- index `idx_tev_received_at` BRIN si volume > 10 M.
- partitionnement par mois différé en Phase 7 (création
  `tracking_events_log_yyyymm` automatisée par cron).

## 7. Memory store fallback

Pattern existant (`src/lib/db/client.ts`). Étendre avec :

```ts
type MemoryStore = {
  // … existant
  trackingPages: Map<string, TrackingPage>;
  trackingComponents: Map<string, TrackingComponent>;
  trackingEventDefinitions: Map<string, TrackingEventDefinition>;
  trackingComponentEvents: Map<string, TrackingComponentEvent>;
  trackingProviders: Map<string, TrackingProvider>;
  trackingEventsLog: Map<string, TrackingEventLogEntry>; // FIFO 5000 max
  trackingConsentSnapshots: Map<string, TrackingConsentSnapshot>; // FIFO 1000 max
};
```

Pour `trackingEventsLog` mémoire : LRU 5000 entrées avec eviction
sur insertion (sinon explose en dev).

## 8. Indexes & performance

- `idx_tev_received_at` (BRIN) pour scans temporels rapides.
- `idx_tev_event_name` (BTREE) pour group-by nom.
- `idx_tev_conversion` (partial) pour funnels.
- Toutes les FK avec `ON DELETE CASCADE` pour `tracking_components` →
  `tracking_component_events` (purger une config nettoie tout).
- `tracking_providers.capi_token` chiffré côté code (cf
  `src/lib/webhooks/secrets.ts` existant, à réutiliser).

## 9. Retention & purge

Cron Vercel `/api/cron/tracking-purge` lancé chaque nuit (3h UTC) :

```sql
DELETE FROM tracking_events_log WHERE received_at < NOW() - INTERVAL '13 months';
DELETE FROM tracking_consent_snapshots WHERE created_at < NOW() - INTERVAL '36 months';
```

Audit : avant purge, `INSERT INTO audit_events (action, meta) VALUES ('tracking.purge', …)`.

## 10. Seed initial

`scripts/seed-tracking.ts` :

1. Lance `scan-tracking-inventory` → manifeste JSON.
2. UPSERT `tracking_pages` + `tracking_components` + `tracking_pages_components`.
3. INSERT `tracking_event_definitions` depuis
   `src/lib/tracking/event-catalog.ts` (constante TS, source de
   vérité pour le runtime).
4. INSERT `tracking_providers` (5 lignes : meta, tiktok, google_ads,
   google_ga4, snap, pinterest), tous `disabled` au départ.

Idempotent : tournant en CI à chaque déploiement.
