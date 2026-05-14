# MSW integration test spec — listmonk-sync

> File: `apps/web/src/lib/mail/campaigns/listmonk-sync.test.ts`
> Mock le serveur Listmonk via MSW handlers.

## Setup MSW

```typescript
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const handlers = [
  rest.post('http://127.0.0.1:9000/api/lists', (req, res, ctx) => {
    return res(ctx.json({ data: { id: 42, name: 'fg-vip-abc' } }));
  }),
  rest.post('http://127.0.0.1:9000/api/import/subscribers', (req, res, ctx) => {
    return res(ctx.json({ data: { status: 'queued' } }));
  }),
  rest.get('http://127.0.0.1:9000/api/import/subscribers/status', (req, res, ctx) => {
    return res(ctx.json({ data: { status: 'done', count: 47 } }));
  }),
];

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Scénarios

### Happy path : push 50 emails
```typescript
it('pushes 50 emails to new ephemeral list', async () => {
  const drizzle = makeFakeDrizzle({
    selectResult: emailsFromSnapshot(50), // factory
  });
  vi.mocked(getDb).mockReturnValue(drizzle as never);
  
  const result = await pushSnapshotToListmonk('snap-1', { listName: 'fg-test-abc' });
  
  expect(result.listmonkListId).toBe(42);
  expect(result.pushed).toBe(50);
  expect(drizzle.calls.update[0].set).toMatchObject({
    listmonk_list_id: 42,
    listmonk_list_name: 'fg-test-abc',
  });
});
```

### Idempotency : snapshot already pushed
```typescript
it('returns existing list_id if snapshot already pushed', async () => {
  // pre : snapshot row has listmonk_list_id=42 already
  const drizzle = makeFakeDrizzle({
    selectResult: [{ listmonk_list_id: 42 }],
  });
  
  const result = await pushSnapshotToListmonk('snap-1', {});
  
  expect(result.listmonkListId).toBe(42);
  // POST /api/lists NOT called
});
```

### Erreur : Listmonk 503
```typescript
it('retries on 503 then succeeds', async () => {
  let attempt = 0;
  server.use(rest.post('http://127.0.0.1:9000/api/lists', (req, res, ctx) => {
    attempt += 1;
    if (attempt < 3) return res(ctx.status(503));
    return res(ctx.json({ data: { id: 42 } }));
  }));
  
  const result = await pushSnapshotToListmonk('snap-1', {});
  expect(attempt).toBe(3);
  expect(result.listmonkListId).toBe(42);
});

it('fails after 3 retries', async () => {
  server.use(rest.post('http://127.0.0.1:9000/api/lists', (req, res, ctx) =>
    res(ctx.status(503))));
  await expect(pushSnapshotToListmonk('snap-1', {})).rejects.toThrow(/listmonk/i);
});
```

### Erreur : Listmonk auth 401
```typescript
it('fails fast on 401 (no retry)', async () => {
  server.use(rest.post('http://127.0.0.1:9000/api/lists', (req, res, ctx) =>
    res(ctx.status(401))));
  await expect(pushSnapshotToListmonk('snap-1', {})).rejects.toThrow(/unauthorized|401/i);
});
```

### Erreur : Liste name conflict (409)
```typescript
it('retries with suffix on 409', async () => {
  let calls = 0;
  server.use(rest.post('http://127.0.0.1:9000/api/lists', async (req, res, ctx) => {
    calls += 1;
    const body = await req.json();
    if (calls === 1 && body.name === 'fg-test-abc') return res(ctx.status(409));
    if (calls === 2 && body.name.startsWith('fg-test-abc-')) return res(ctx.json({ data: { id: 42 } }));
    return res(ctx.status(500));
  }));
  
  const result = await pushSnapshotToListmonk('snap-1', { listName: 'fg-test-abc' });
  expect(result.listmonkListId).toBe(42);
});
```

### Chunking : 10k emails en chunks de 1000
```typescript
it('chunks 10k emails into 10 batches', async () => {
  // pre : 10k members in snapshot
  let batchCalls = 0;
  server.use(rest.post('http://127.0.0.1:9000/api/import/subscribers', async (req, res, ctx) => {
    batchCalls += 1;
    const body = await req.json();
    expect(body.subscribers).toHaveLength(1000);  // max chunk
    return res(ctx.json({ data: { status: 'queued' } }));
  }));
  
  await pushSnapshotToListmonk('snap-10k', {});
  expect(batchCalls).toBe(10);
});
```

## Cleanup endpoint

### Happy path
```typescript
it('deletes ephemeral lists older than 30d', async () => {
  // pre : snapshot row with purgeable_after = past
  let deleteCalled = false;
  server.use(rest.delete('http://127.0.0.1:9000/api/lists/42', (req, res, ctx) => {
    deleteCalled = true;
    return res(ctx.json({ ok: true }));
  }));
  
  const result = await cleanupExpiredListmonkLists();
  expect(deleteCalled).toBe(true);
  expect(result.purged).toBe(1);
});
```

### Liste déjà sup côté Listmonk (404)
```typescript
it('handles 404 (list already deleted manually)', async () => {
  server.use(rest.delete('http://127.0.0.1:9000/api/lists/42', (req, res, ctx) =>
    res(ctx.status(404))));
  
  const result = await cleanupExpiredListmonkLists();
  // No error, just update DB to clear listmonk_list_id
  expect(result.purged).toBe(1);
});
```
