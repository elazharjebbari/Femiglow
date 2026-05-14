# Queries catalog

> Inventaire des queries Drizzle/SQL exposées par la couche data,
> classées par phase. Chaque query a son test associé.

## Notation

```
queryName(args)
  Returns: Type
  Used by: <endpoint or component>
  Test: <test file>
```

---

## M5.1 — Transactional cockpit

### `listOutboxFiltered(filters, pagination)`
```typescript
type Filters = {
  status?: OutboxStatus[];
  template?: string;            // glob OK
  toEmail?: string;
  source?: string;
  after?: Date;
  before?: Date;
  hasError?: boolean;
  attemptsOp?: { op: 'gt'|'lt'|'eq'; value: number };
};
type Pagination = { limit: number; offset: number };
```
- Returns: `{ rows: OutboxRow[]; total: number }`
- Used by: `/api/admin/emails/transactional/search`
- Test: `outbox-queries.test.ts § listOutboxFiltered`

### `summarizeOutbox(window)`
```typescript
type Window = '1h' | '24h' | '7d';
```
- Returns: `{ delivered: number; queued: number; failed: number; hardBounced: number; sparkline: number[12] }`
- Used by: KPI header
- Test: `outbox-queries.test.ts § summarizeOutbox`

### `bulkRetry(ids[])`
- Returns: `{ retried: number; skipped: number }`
- Used by: bulk action
- Test: `outbox-queries.test.ts § bulkRetry idempotent`

### `getViewsForAdmin(email, scope)`
- Returns: `AdminEmailView[]`
- Used by: saved views sidebar
- Test: `admin-views-queries.test.ts`

### `createView(...)`, `updateView(...)`, `deleteView(...)`
- standards CRUD

---

## M5.2 — User events

### `insertUserEvent(payload)`
- Returns: `void`
- Used by: tous les bridges
- Test: `user-event-insert.test.ts`

### `countEventsByName(window)`
- Returns: `{ [eventName: string]: number }`
- Used by: dashboard debug + admin tools
- Test: idem

### `getRecentEventsForEmail(email, limit=50)`
- Returns: `UserEvent[]`
- Used by: lead detail (déjà existant?), automation debug
- Test: idem

---

## M5.3 — Audiences

### `compileRules(rules: RulesJson): SelectQuery`
- Returns: Drizzle `SelectBuilder` for emails matching rules
- Used by: preview + snapshot
- Test: `rules-compiler.test.ts` (exhaustif, ≥ 95% branches)

### `previewAudienceSize(rules, exclusions): Promise<number>`
```sql
SELECT COUNT(DISTINCT email) FROM (compiledQuery) AS matches
WHERE email NOT IN (compiledExclusion);
```
- Returns: count
- Used by: builder UI live preview
- Test: `audience-preview.test.ts`

### `previewAudienceSample(rules, limit=10): Promise<SampleRow[]>`
- Returns: emails + key stats (orders count, total spent)
- Used by: builder UI sample
- Test: idem

### `createAudience(name, rules, opts): Promise<Audience>`
- Returns: created row
- Used by: API
- Test: `audience-crud.test.ts`

### `snapshotAudience(audienceId, opts): Promise<Snapshot>`
- Returns: `{ id, status, size }` (async via job_id si > 5s estimé)
- Used by: API
- Test: `snapshot-engine.test.ts`

### `getAudienceSnapshots(audienceId, limit=20)`
- Returns: `Snapshot[]`
- Used by: detail page
- Test: idem

---

## M5.4 — Campaigns

### `pushSnapshotToListmonk(snapshotId): Promise<{ list_id, campaign_id? }>`
- Returns: list_id Listmonk + optional campaign_id
- Used by: `finalizeCampaign()` server action
- Test: `listmonk-sync.test.ts` (avec MSW pour mocker Listmonk API)

### `cleanupExpiredListmonkLists(): Promise<{ purged: number }>`
- Returns: count
- Used by: cron J+30
- Test: idem

---

## M5.5 — Automations

### `triggerAutomation(slug, context, opts): Promise<{ runId?: string; skipped?: string }>`
- Returns: runId si déclenché, raison si skip
- Used by: bridges trigger (cart-abandon-scanner, lead-created hook…)
- Test: `automation-trigger.test.ts`

### `advanceRun(runId): Promise<void>`
- Returns: void (mutate run in DB)
- Used by: cron tick
- Test: `automation-runner.test.ts` (un test par step kind)

### `cancelRun(runId, reason): Promise<void>`
- Returns: void
- Used by: admin UI cancel
- Test: idem

### `getAutomationCatalog(): Promise<EventCatalogEntry[]>`
- Returns: events disponibles pour configuration
- Used by: wizard step "trigger"
- Test: `event-catalog.test.ts`

### `evaluateCondition(rules, context): Promise<boolean>`
- Returns: bool (réutilise rules-compiler mais sur 1 user en mémoire)
- Used by: branch steps, trigger_conditions
- Test: `condition-evaluator.test.ts`

### `applyTag(leadId, tag, source): Promise<void>`
### `removeTag(leadId, tag): Promise<void>`
### `updateLeadField(leadId, field, value): Promise<void>`
### `callWebhook(url, body): Promise<{ status: number; durationMs: number }>`

---

## Conventions perfs

- **N+1** strictement interdit ; toujours `IN (...)` ou `JOIN`
- **Pagination** : `LIMIT + offset` jusqu'à 1000, au-delà cursor-based
- **Read replicas** : pas en V1, mais queries de preview audience sont
  candidates pour replica si jamais
