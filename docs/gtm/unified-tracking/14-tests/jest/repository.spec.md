# Tests repository — Spec

Cible : `apps/web/src/lib/tracking/plan/repository.ts`

Tests **d'intégration** avec une vraie DB Postgres (test container ou local DB de test).

## Setup

```typescript
import { newDb } from 'pg-mem'
import { drizzle } from 'drizzle-orm/pg-mem'
import * as schema from '@/lib/db/schema/tracking-plan'

let db: ReturnType<typeof drizzle>

beforeAll(async () => {
  const pgMem = newDb()
  pgMem.public.query(readFileSync('migrations/tracking-plan.sql', 'utf-8'))
  db = drizzle(pgMem.adapters.createPg(), { schema })
})

beforeEach(async () => {
  await db.delete(schema.trackingPlanAudit)
  await db.delete(schema.trackingPlans)
})
```

Alternative : Testcontainers avec vrai Postgres :
```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql'

let container: StartedPostgreSqlContainer
beforeAll(async () => {
  container = await new PostgreSqlContainer().start()
  // ... run migrations
})
```

## Tests CRUD

```typescript
describe('TrackingPlanRepository', () => {
  describe('create', () => {
    it('creates plan + audit entry atomically', async () => {
      const plan = buildPlan({ name: 'Test Plan' })
      
      const created = await repo.create(plan, 'younes@femiglow.ma')
      
      expect(created.id).toBeDefined()
      expect(created.status).toBe('draft')
      
      const audits = await db.select().from(schema.trackingPlanAudit)
      expect(audits).toHaveLength(1)
      expect(audits[0]).toMatchObject({
        planId: created.id,
        action: 'create',
        actorEmail: 'younes@femiglow.ma',
      })
    })

    it('rejects create with invalid Zod input', async () => {
      const invalid = { name: '' }  // Plan minimal invalide
      await expect(repo.create(invalid as any, 'test@test.com')).rejects.toThrow()
    })
  })

  describe('findActive', () => {
    it('returns active plan', async () => {
      const plan = buildPlan({ status: 'draft' })
      const created = await repo.create(plan, 'test@test.com')
      await repo.activate(created.id, 'test@test.com')
      
      const active = await repo.findActive()
      expect(active?.id).toBe(created.id)
      expect(active?.status).toBe('active')
    })

    it('returns null when no active plan', async () => {
      const active = await repo.findActive()
      expect(active).toBeNull()
    })
  })

  describe('activate', () => {
    it('archives previously active plan', async () => {
      const planA = await repo.create(buildPlan({ name: 'A' }), 'test@test.com')
      const planB = await repo.create(buildPlan({ name: 'B' }), 'test@test.com')
      
      await repo.activate(planA.id, 'test@test.com')
      expect((await repo.findById(planA.id))?.status).toBe('active')
      
      await repo.activate(planB.id, 'test@test.com')
      
      const finalA = await repo.findById(planA.id)
      const finalB = await repo.findById(planB.id)
      
      expect(finalA?.status).toBe('archived')
      expect(finalB?.status).toBe('active')
    })

    it('appends audit entry for activation', async () => {
      const plan = await repo.create(buildPlan({}), 'test@test.com')
      await repo.activate(plan.id, 'amal@femiglow.ma')
      
      const audits = await db
        .select()
        .from(schema.trackingPlanAudit)
        .where(eq(schema.trackingPlanAudit.action, 'activate'))
      
      expect(audits).toHaveLength(1)
      expect(audits[0].actorEmail).toBe('amal@femiglow.ma')
    })
  })

  describe('archive', () => {
    it('archives plan + audit entry', async () => {
      const plan = await repo.create(buildPlan({}), 'test@test.com')
      await repo.activate(plan.id, 'test@test.com')
      await repo.archive(plan.id, 'test@test.com')
      
      expect((await repo.findById(plan.id))?.status).toBe('archived')
    })

    it('rejects archive of active plan with another plan already archive-targeted', async () => {
      // edge case business : can't archive the only active plan without replacement
      const plan = await repo.create(buildPlan({}), 'test@test.com')
      await repo.activate(plan.id, 'test@test.com')
      
      // No other plan ready to replace it
      // Le repo doit refuser
      await expect(repo.archive(plan.id, 'test@test.com'))
        .rejects.toThrow(/cannot archive the only active plan/)
    })
  })
})
```

## Contraintes DB

```typescript
describe('DB constraints', () => {
  it('enforces unique active plan (partial unique index)', async () => {
    const planA = await repo.create(buildPlan({}), 'test@test.com')
    await repo.activate(planA.id, 'test@test.com')
    
    const planB = await repo.create(buildPlan({}), 'test@test.com')
    
    // Tentative d'insertion directe avec status=active sans archiver A
    // doit échouer au niveau DB
    await expect(
      db.update(schema.trackingPlans)
        .set({ status: 'active' })
        .where(eq(schema.trackingPlans.id, planB.id))
    ).rejects.toThrow(/unique constraint/)
  })

  it('audit table blocks UPDATE (trigger)', async () => {
    const plan = await repo.create(buildPlan({}), 'test@test.com')
    
    const audits = await db.select().from(schema.trackingPlanAudit)
    expect(audits).toHaveLength(1)
    
    // Tentative UPDATE direct sur audit → trigger doit bloquer
    await expect(
      db.update(schema.trackingPlanAudit)
        .set({ action: 'create' })
        .where(eq(schema.trackingPlanAudit.id, audits[0].id))
    ).rejects.toThrow(/audit table is append-only/)
  })

  it('audit table blocks DELETE (trigger)', async () => {
    const plan = await repo.create(buildPlan({}), 'test@test.com')
    
    await expect(
      db.delete(schema.trackingPlanAudit)
    ).rejects.toThrow(/audit table is append-only/)
  })
})
```

## Optimistic concurrency

```typescript
describe('optimistic concurrency', () => {
  it('increments version on update', async () => {
    const plan = await repo.create(buildPlan({}), 'test@test.com')
    expect(plan.version).toBe(1)
    
    const updated = await repo.update(plan.id, {
      name: 'Renamed'
    }, plan.version, 'test@test.com')
    
    expect(updated.version).toBe(2)
  })

  it('rejects update with stale version', async () => {
    const plan = await repo.create(buildPlan({}), 'test@test.com')
    
    // Two concurrent updates with same starting version
    const promise1 = repo.update(plan.id, { name: 'A' }, plan.version, 'test@test.com')
    const promise2 = repo.update(plan.id, { name: 'B' }, plan.version, 'test@test.com')
    
    const results = await Promise.allSettled([promise1, promise2])
    
    // Au moins l'un doit échouer
    const failed = results.filter(r => r.status === 'rejected')
    expect(failed.length).toBeGreaterThanOrEqual(1)
  })
})
```

## Performance

```typescript
describe('performance', () => {
  it('findActive < 50ms', async () => {
    // Pre-fill avec 100 plans
    for (let i = 0; i < 100; i++) {
      await repo.create(buildPlan({ name: `Plan ${i}` }), 'test@test.com')
    }
    // 1 actif
    const plan = await repo.create(buildPlan({}), 'test@test.com')
    await repo.activate(plan.id, 'test@test.com')
    
    const start = performance.now()
    await repo.findActive()
    const elapsed = performance.now() - start
    
    expect(elapsed).toBeLessThan(50)
  })
})
```

## Couverture cible

- Statements : 85%
- Branches : 80%
- Functions : 90%
- Lines : 85%
