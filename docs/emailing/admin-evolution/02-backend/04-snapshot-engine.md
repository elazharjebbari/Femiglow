# Snapshot engine

## Rôle

Matérialiser une audience (rules) en liste figée d'emails, dans
`email_audience_snapshot_member`, atomic et idempotent.

## Contrat

```typescript
type SnapshotOpts = {
  snapshotKey?: string;       // pour idempotency
  source?: 'manual' | 'campaign' | 'automation';
  campaignId?: string;
};

type SnapshotResult = {
  snapshotId: string;
  size: number;
  status: 'pending' | 'running' | 'done' | 'errored';
  durationMs?: number;
};

export async function snapshotAudience(
  audienceId: string,
  opts?: SnapshotOpts,
): Promise<SnapshotResult>;
```

## Workflow

```
1. INSERT email_audience_snapshot (status='pending')
   - Si UNIQUE (audience_id, snapshot_key) déjà existante :
     retourne l'existante (idempotent)
2. UPDATE status='running', completed_at=NULL
3. Compile rules → SQL
4. INSERT email_audience_snapshot_member
   SELECT email FROM (compiled SELECT) AS matches
   ON CONFLICT DO NOTHING
5. UPDATE size = COUNT, status='done', completed_at=now()
6. Return { snapshotId, size, status='done' }

Si erreur en cours de route :
- UPDATE status='errored', errored_reason=..., errored_at=now()
- Rollback transaction
- Throw → caller doit retry ou notifier l'admin
```

## Mode async (> 5s estimé)

Si la preview a indiqué `size > 10k`, on bascule en mode async :

1. INSERT snapshot status='pending'
2. Enqueue job `admin_job` (table à créer ou bricoler avec automation runner)
3. Return immédiatement `{ snapshotId, status: 'pending' }`
4. Frontend poll `GET /api/admin/emails/audiences/snapshots/[id]`

Implémentation simple V1 : le `snapshotAudience()` côté serveur peut
faire le boulot synchrone jusqu'à 30s (timeout HTTP), et au-delà on
gère via cron tick.

## Sécurité transactionnelle

```typescript
await db.transaction(async (tx) => {
  await tx.update(snapshot).set({ status: 'running' }).where(...);
  
  const inserted = await tx.execute(sql`
    INSERT INTO email_audience_snapshot_member (snapshot_id, email, payload)
    SELECT 
      ${snapshotId} AS snapshot_id,
      email,
      jsonb_build_object('firstName', first_name) AS payload
    FROM (${compiledQuery}) AS matches
    ON CONFLICT (snapshot_id, email) DO NOTHING
  `);
  
  await tx.update(snapshot).set({ 
    status: 'done', 
    size: inserted.rowCount, 
    completed_at: sql`now()` 
  });
});
```

Si la transaction échoue → snapshot reste en `running` (jamais `done`).
Cron de cleanup peut détecter les "running" > 1h → marquer `errored`.

## Idempotency

Use case : la campagne X est sur le point d'envoyer une audience VIP,
mais le worker crashe en pleine sync Listmonk. Au retry, on doit
réutiliser la même snapshot (pas en créer une nouvelle).

```typescript
// Avant snapshot, le caller envoie un snapshot_key construit comme :
const snapshotKey = `campaign-${campaignId}`;
// ou :
const snapshotKey = `automation-run-${runId}`;

// Le serveur :
const existing = await db.query.snapshot.findFirst({
  where: and(
    eq(snapshot.audience_id, audienceId),
    eq(snapshot.snapshot_key, snapshotKey),
  ),
});
if (existing) return existing;  // idempotent return
```

## Purge

Cron quotidien :
```sql
DELETE FROM email_audience_snapshot WHERE purgeable_after < now();
-- CASCADE supprime les members
```

Et nettoyage des listes Listmonk éphémères associées (voir [05-listmonk-sync.md](05-listmonk-sync.md)).

## Tests

- Happy path : audience small (10 rows) → snapshot done en < 1s
- Volume : audience 10k → < 30s
- Idempotency : 2× appel avec même snapshotKey → 1 row + même id retourné
- Erreur compilation rules → status='errored'
- Concurrency : 2 appels parallèles avec même key → 1 seul snapshot créé
  (UNIQUE constraint catch)
- Rollback : kill connexion en plein INSERT → snapshot reste 'running'
  mais aucun member partial

Voir [11-tests/01-jest-unit/snapshot-engine.test.spec.md](../11-tests/01-jest-unit/snapshot-engine.test.spec.md).
