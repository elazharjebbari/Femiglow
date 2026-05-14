# Backend overview

## Structure du code

```
apps/web/src/lib/
├── mail/
│   ├── outbox.ts                          (existant — étendu M5.1)
│   ├── transactional/
│   │   ├── search.ts                      ⭐ M5.1 — listOutboxFiltered + parser
│   │   ├── filters-parser.ts              ⭐ M5.1 — parser Cmd-K syntax
│   │   ├── summary.ts                     ⭐ M5.1 — summarizeOutbox
│   │   └── bulk-actions.ts                ⭐ M5.1 — bulkRetry, bulkSuppress, exportCsv
│   ├── audiences/
│   │   ├── rules-types.ts                 ⭐ M5.3 — Zod schemas (RulesGroup, Rule)
│   │   ├── rules-compiler.ts              ⭐ M5.3 — compile(rules) → Drizzle query
│   │   ├── condition-evaluator.ts         ⭐ M5.3 — eval(rules, user) → boolean (réutilisé M5.5)
│   │   ├── preview.ts                     ⭐ M5.3 — previewSize, previewSample
│   │   ├── snapshot.ts                    ⭐ M5.3 — snapshotAudience engine
│   │   └── purge.ts                       ⭐ M5.3 — cron purge snapshots > 90j
│   ├── campaigns/
│   │   ├── listmonk-sync.ts               ⭐ M5.4 — pushSnapshotToListmonk + cleanup
│   │   └── finalize-v2.ts                 ⭐ M5.4 — finalize avec audience native
│   ├── automation/
│   │   ├── types.ts                       (existant — étendu M5.5)
│   │   ├── runner.ts                      (existant — étendu M5.5 runner-v2)
│   │   ├── step-handlers/                 ⭐ M5.5 — 1 handler par step kind
│   │   │   ├── wait.ts
│   │   │   ├── send.ts
│   │   │   ├── branch.ts
│   │   │   ├── tag.ts
│   │   │   ├── update-lead.ts
│   │   │   ├── webhook.ts
│   │   │   └── wait-for-event.ts
│   │   ├── event-catalog.ts               ⭐ M5.5 — getAutomationCatalog
│   │   └── frequency.ts                   ⭐ M5.5 — cooldown + quiet hours + daily cap
│   ├── user-events/
│   │   ├── bridges/                       ⭐ M5.2
│   │   │   ├── web-tracking.ts
│   │   │   ├── email-webhooks.ts
│   │   │   ├── server-actions.ts
│   │   │   └── admin-actions.ts
│   │   ├── insert.ts                      ⭐ M5.2 — single point d'écriture
│   │   └── backfill.ts                    ⭐ M5.2 — one-shot historique
│   └── admin-views/
│       └── queries.ts                     ⭐ M5.1 — CRUD admin_email_view
└── db/
    ├── schema-emails.ts                   (existant — étendu)
    └── schema-evolution-m5.ts             ⭐ nouvelles tables M5
```

## APIs et server actions

Détails dans :
- [01-api-endpoints.md](01-api-endpoints.md) — REST routes
- [02-server-actions.md](02-server-actions.md) — Next.js server actions

## Engines

Détails dans :
- [03-rules-compiler.md](03-rules-compiler.md) — Le compilateur (cœur)
- [04-snapshot-engine.md](04-snapshot-engine.md)
- [05-listmonk-sync.md](05-listmonk-sync.md)
- [06-automation-runner-v2.md](06-automation-runner-v2.md)

## Patterns transverses

### Validation Zod aux frontières
```typescript
const Input = z.object({...});
export async function someAction(input: unknown) {
  const parsed = Input.parse(input);  // throws si invalide
  // ...
}
```

### Audit log automatique
Server actions importent un helper :
```typescript
import { withAudit } from '@/lib/audit';

export const createAudience = withAudit('emailing.audience.created',
  async (input) => { ... }
);
```

### Logs structurés
Tout `logger.info/warn/error` inclut un `event` standardisé. Pattern :
```typescript
logger.info('audience.snapshot.completed', { audienceId, snapshotId, size, durationMs });
```

### Error handling
- Erreurs **utilisateur** (validation) : 400/422 + body `{ error, issues }`
- Erreurs **infra** (DB, Listmonk down) : 500 + log + alerte
- Toujours wrap les actions externes (`try { ... } catch`) avec retry
  exponentiel (réutiliser `lib/mail/backoff.ts`)

### Rate-limit
Les endpoints lourds (preview audience, snapshot trigger) doivent passer
par `enforceAdminRateLimit('audiences-preview', req)` — variante de
`enforceMailRateLimit` (à créer en M5.1).

### Idempotency
Pour les actions qui pourraient être doublées (snapshot, push Listmonk),
support de `Idempotency-Key` header :
```typescript
const idempotencyKey = req.headers.get('idempotency-key');
if (idempotencyKey) {
  const existing = await findResultByKey(idempotencyKey);
  if (existing) return existing;
}
```

## Sécurité

- Toute server action vérifie `requireAdmin()` en première ligne
- Pas de SQL string concat : Drizzle parameterized partout
- Logs : pas de PII (emails) en clair ; hashs si nécessaire
