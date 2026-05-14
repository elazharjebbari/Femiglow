# API endpoints

> Inventaire des endpoints HTTP exposés. Convention : routes serveur
> Next.js, auth `requireAdmin()` partout.

## Conventions

| Aspect | Standard |
|---|---|
| Path prefix | `/api/admin/emails/...` |
| Auth | `requireAdmin()` (throws 401 sinon) |
| Body | JSON, Zod-validated |
| Success | 200 + body JSON OU 202 + `{ jobId }` si async |
| Validation error | 422 + `{ error, issues }` |
| Auth error | 401 |
| Not found | 404 |
| Server error | 500 + `{ ok: false, error, ref }` |

## Transactional cockpit (M5.1)

### POST `/api/admin/emails/transactional/search`
Body :
```typescript
{
  filters: {
    status?: OutboxStatus[];
    template?: string;       // glob
    toEmail?: string;
    source?: string;
    after?: string;          // ISO
    before?: string;
    hasError?: boolean;
    attemptsOp?: { op: '>'|'<'|'='; value: number };
  };
  pagination: { limit: number; offset: number };
  sort?: 'date_desc' | 'date_asc' | 'status' | 'template';
}
```
Returns :
```typescript
{ rows: OutboxRow[]; total: number; window: 'matched'|'truncated' }
```

### GET `/api/admin/emails/transactional/summary?window=1h`
Returns :
```typescript
{
  delivered: number; queued: number; failed: number; hardBounced: number;
  sparkline: number[];     // 12 buckets de window/12
  comparison: { delivered: '+12%' | '-3%'; ... }
}
```

### POST `/api/admin/emails/transactional/bulk-retry`
Body : `{ ids: string[] }` (max 500)
Returns : `{ retried: number; skipped: number }`

### POST `/api/admin/emails/transactional/bulk-suppress`
Body : `{ ids: string[]; reason: 'manual_admin' }`
Returns : `{ suppressed: number }`

### GET `/api/admin/emails/transactional/export?...filters`
Returns : CSV stream (Content-Type: text/csv)

### Views CRUD
- GET `/api/admin/emails/views?scope=transactional`
- POST `/api/admin/emails/views` (body: name, scope, filter_state)
- PATCH `/api/admin/emails/views/[id]`
- DELETE `/api/admin/emails/views/[id]`

## User events (M5.2)

### POST `/api/admin/emails/events` (debug, optionnel)
Tail des derniers events arrivés.

### GET `/api/admin/emails/events/stats?window=24h`
Returns : `{ byName: { [name]: count }; total: number }`

## Audiences (M5.3)

### Audience CRUD

| Méthode | Path | Description |
|---|---|---|
| GET | `/api/admin/emails/audiences` | List (filter: search, owner, sort) |
| POST | `/api/admin/emails/audiences` | Create |
| GET | `/api/admin/emails/audiences/[id]` | Detail |
| PATCH | `/api/admin/emails/audiences/[id]` | Update |
| DELETE | `/api/admin/emails/audiences/[id]` | Soft delete |

POST body :
```typescript
{
  slug: string;
  name: string;
  description?: string;
  rules: RulesGroup;
  exclusionFlags?: ExclusionFlags;
  evaluationMode?: 'static' | 'dynamic';
}
```

### Audience preview

POST `/api/admin/emails/audiences/preview-size`
Body : `{ rules, exclusionFlags? }`
Returns : `{ size: number; durationMs: number }`
Cache : Redis 60s key sur hash(rules + exclusion)

POST `/api/admin/emails/audiences/preview-sample`
Body : `{ rules, exclusionFlags?, limit?: number }`  (default 10, max 50)
Returns : `{ samples: { email, payload }[]; size: number }`

### Snapshot

POST `/api/admin/emails/audiences/[id]/snapshot`
Body (optional) : `{ snapshotKey?: string }`
Returns :
- Async : `{ jobId, status: 'pending' }` → poll
- Sync (< 5s) : `{ snapshotId, size }`

GET `/api/admin/emails/audiences/[id]/snapshots`
Returns : `Snapshot[]`

GET `/api/admin/emails/audiences/snapshots/[snapshotId]/members?limit=100`
Returns : `{ emails: string[]; total: number; nextCursor?: string }`

## Campaigns (M5.4)

### Wizard endpoints

Existing wizard endpoints sont maintenus. Modifications :

POST `/api/admin/emails/campaigns/[id]/audience`
Body : `{ audienceId: string } | { rules: RulesGroup }`
Effet : associe l'audience au draft de campagne

POST `/api/admin/emails/campaigns/[id]/finalize`
Effet :
1. Snapshot audience (si dynamic)
2. Push Listmonk éphémère
3. Create campaign Listmonk
4. Update `email_campaign_link.status='scheduled'|'sent'`

## Automations (M5.5)

### Automation CRUD

| Méthode | Path | Description |
|---|---|---|
| GET | `/api/admin/emails/automation` | List |
| POST | `/api/admin/emails/automation` | Create (wizard finalize) |
| GET | `/api/admin/emails/automation/[id]` | Detail |
| PATCH | `/api/admin/emails/automation/[id]` | Update |
| DELETE | `/api/admin/emails/automation/[id]` | Soft delete |
| POST | `/api/admin/emails/automation/[id]/toggle` | active true/false |
| POST | `/api/admin/emails/automation/[id]/clone` | Duplicate |

### Catalogue events

GET `/api/admin/emails/automation/events-catalog`
Returns :
```typescript
{
  events: {
    name: string;        // 'cart.abandoned'
    category: string;    // 'commerce'
    description: string;
    params: { name: string; type: string; description: string }[];
  }[]
}
```

### Run management

GET `/api/admin/emails/automation/runs?status=running&automation_id=...`
Returns : `RunRow[]`

POST `/api/admin/emails/automation/runs/[id]/cancel`
Body : `{ reason?: string }`

GET `/api/admin/emails/automation/runs/[id]/timeline`
Returns : timeline événementielle de l'exécution

### Validation / preview

POST `/api/admin/emails/automation/validate`
Body : automation draft complet
Returns : `{ valid: boolean; errors?: { path, message }[]; estimatedImpact?: { runsPerDay: number; sendsPerDay: number } }`

## Cron endpoints (existing extended)

- `/api/cron/email-outbox` : pick & process batch (existant)
- `/api/cron/email-automation` : tick automation runner (existant, étendu M5.5)
- `/api/cron/email-audience-purge` ⭐ M5.3 : purge snapshots > 90j +
  cleanup listes Listmonk éphémères
- `/api/cron/user-event-backfill` ⭐ M5.2 (one-shot)

## Tests par endpoint

Voir [11-tests/02-msw-integration/](../11-tests/02-msw-integration/) pour
les scénarios MSW par endpoint. Chaque endpoint a au moins :
- Happy path (200)
- Validation errors (422)
- Unauthorized (401)
- Not found (404 si applicable)
- Rate limit (429 si applicable)
- 5xx upstream (Listmonk down)
