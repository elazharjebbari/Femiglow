# MSW integration test spec — transactional endpoints

> File: `apps/web/src/app/api/admin/emails/transactional/__tests__/*.test.ts`
> Pattern existant : auth via mocked session, DB via fake-drizzle.

## POST /api/admin/emails/transactional/search

### Happy path
```typescript
it('returns rows matching filter', async () => {
  vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({
    selectResult: [{ id: '1', status: 'failed', toEmail: 'a@b.c', ... }],
  }) as never);
  
  const res = await POST(makeReq({
    filters: { status: ['failed'] },
    pagination: { limit: 50, offset: 0 },
  }));
  
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.rows).toHaveLength(1);
  expect(body.rows[0].status).toBe('failed');
});
```

### Erreurs
- No body → 400 (invalid JSON)
- Schema invalid (bad filter value) → 422
- Pas authentifié → 401
- Rate limit dépassé → 429
- DB down (drizzle throws) → 500

### Edge cases
- Empty filters → returns all (paginated)
- Limit 0 → 422
- Limit > 1000 → 422 (cap)
- Filter `template: 'unknown-*'` → returns empty array

## GET /api/admin/emails/transactional/summary

### Happy path
```typescript
it('returns 4 KPIs for last 1h', async () => {
  vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({
    selectResult: [{ delivered: 1243, queued: 12, failed: 8, hardBounced: 3 }],
  }) as never);
  
  const res = await GET(makeReq('?window=1h'));
  
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({
    delivered: 1243, queued: 12, failed: 8, hardBounced: 3,
  });
  expect(body.sparkline).toHaveLength(12);
});
```

### Erreurs / edge cases
- Invalid window param → 422
- Window not yet supported → 400
- DB empty → all KPIs 0, sparkline of 0s

## POST /api/admin/emails/transactional/bulk-retry

### Happy path
```typescript
it('retries multiple emails', async () => {
  const drizzle = makeFakeDrizzle({ updateReturning: [{ id: '1' }, { id: '2' }] });
  vi.mocked(getDb).mockReturnValue(drizzle as never);
  
  const res = await POST(makeReq({ ids: ['1', '2'] }));
  
  expect(res.status).toBe(200);
  expect((await res.json()).retried).toBe(2);
  expect(drizzle.calls.update[0].set).toMatchObject({ status: 'pending' });
});
```

### Erreurs / edge cases
- Empty ids → 200, retried=0
- > 500 ids → 422 (limit)
- IDs not in failed/dlq/bounced_soft state → skipped (compteur)
- All IDs already retrying → all skipped

## Views CRUD

### POST /api/admin/emails/views
```typescript
it('creates a view', async () => {
  const drizzle = makeFakeDrizzle({ insertReturning: [{ id: 'view-1' }] });
  vi.mocked(getDb).mockReturnValue(drizzle as never);
  
  const res = await POST(makeReq({
    name: 'Failed today',
    scope: 'transactional',
    filter_state: { filters: { status: ['failed'] } },
  }));
  
  expect(res.status).toBe(200);
  expect((await res.json()).id).toBe('view-1');
});
```

- Duplicate name → 409 Conflict
- Schema invalid → 422
- > 100 views par admin → 422 (limite)

### GET /api/admin/emails/views?scope=transactional
- Returns system + custom views
- Empty list → empty array (200)

### PATCH /api/admin/emails/views/[id]
- View pas owned by current admin → 403
- System view (is_system=true) → 403 (read-only)
- Name change OK
- filter_state change OK

### DELETE /api/admin/emails/views/[id]
- View pas owned → 403
- System view → 403
- Soft delete (set deletedAt) → 200
- Cascade : aucun (les filtres restent dans l'URL utilisateur)

## Convention erreurs

```typescript
// 401 sans body verbose (sécurité)
expect(await res.text()).toBe('Unauthorized');

// 422 avec issues Zod
expect(await res.json()).toMatchObject({
  error: expect.any(String),
  issues: expect.any(Object),
});

// 429 avec Retry-After
expect(res.headers.get('Retry-After')).toBeDefined();

// 500 avec ref pour support
expect(await res.json()).toMatchObject({
  ok: false,
  error: expect.any(String),
  ref: expect.stringMatching(/^err-[a-z0-9]+$/),
});
```
