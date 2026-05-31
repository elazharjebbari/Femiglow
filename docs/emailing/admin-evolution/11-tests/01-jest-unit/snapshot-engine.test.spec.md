# Test spec — snapshot-engine

> File: `apps/web/src/lib/mail/audiences/snapshot.test.ts`

## Structure

```typescript
describe('snapshotAudience', () => {
  describe('happy path', () => { ... });
  describe('idempotency', () => { ... });
  describe('error handling', () => { ... });
  describe('concurrency', () => { ... });
});
```

## Scénarios

### Happy path
- Small audience (10 rows) → snapshot status='done', size=10, < 1s
- Empty audience → snapshot status='done', size=0
- Members inserted with payload (firstName, totalSpent extracted via subquery)

### Idempotency
- 2× appels avec même `snapshotKey` → 1 row + même snapshotId retourné
  au 2nd appel (pas de re-execute)
- Sans snapshotKey, 2 appels → 2 snapshots distincts (intended)

### Error handling
- Audience deleted entre snapshot start et execution → ROLLBACK,
  status='errored', errored_reason='audience deleted'
- DB connection lost mid-INSERT → ROLLBACK, status='running' (visible
  pour reset manuel)
- Rules compiler throws → status='errored' immédiat

### Concurrency
- 2 appels parallèles avec même (audience_id, snapshot_key) → 1 row
  créé (UNIQUE constraint catch), 2nd appel récupère le 1er

### Async mode
- Estimation size > 5000 → bascule en async, retourne { snapshotId,
  status: 'pending' }
- Le caller poll /api/admin/.../snapshots/[id] jusqu'à 'done' ou 'errored'

### Performance
- 1k rows : < 5s
- 10k rows : < 30s
- 100k rows : test skip (volume > target V1)

## Mocking

- DB : `makeFakeDrizzle` étendu pour simuler INSERT … SELECT
- Rules compiler : import réel (déjà testé séparément)
- Cron : pas applicable au snapshot direct

## Edge cases

- Snapshot d'une audience qui n'existe plus → throws
- Snapshot avec exclusion_flags qui supprime 100% → size=0, status='done'
- Email avec caractères Unicode → INSERT OK, pas d'encoding error
- 2 emails identiques dans audience compilée → ON CONFLICT DO NOTHING (1 row)

## Assertions

```typescript
it('inserts members atomically', async () => {
  const drizzle = makeFakeDrizzle({ ... });
  const result = await snapshotAudience('aud-1', { source: 'manual' });
  
  expect(result.status).toBe('done');
  expect(result.size).toBe(47);
  
  // Vérifier que le INSERT snapshot + UPDATE done sont dans la même transaction
  expect(drizzle.transaction).toHaveBeenCalledTimes(1);
});
```
