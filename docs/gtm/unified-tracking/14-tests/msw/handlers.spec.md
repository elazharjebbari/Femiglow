# Handlers MSW — Spec

Fichier cible : `apps/web/src/mocks/handlers/tracking.ts`.

## Structure générale

```typescript
import { http, HttpResponse, delay } from 'msw'
import { plansDb, auditDb } from '../fixtures/tracking-store'
import { trackingPlanSchema } from '@/lib/tracking/plan/types'

const BASE = '/api/tracking'

export const handlers = [
  // … handlers listés ci-dessous
]
```

## GET /api/tracking/plans

```typescript
http.get(`${BASE}/plans`, async ({ request }) => {
  await delay(80)
  const url = new URL(request.url)
  const status = url.searchParams.get('status')  // 'draft' | 'active' | 'archived'
  const search = url.searchParams.get('search')
  
  let plans = [...plansDb.values()]
  
  if (status) plans = plans.filter(p => p.status === status)
  if (search) plans = plans.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  )
  
  return HttpResponse.json({
    data: plans,
    total: plans.length,
  })
})
```

## GET /api/tracking/plans/:id

```typescript
http.get(`${BASE}/plans/:id`, async ({ params }) => {
  await delay(60)
  const plan = plansDb.get(params.id as string)
  
  if (!plan) {
    return HttpResponse.json(
      { error: 'plan_not_found', id: params.id },
      { status: 404 }
    )
  }
  
  return HttpResponse.json(plan)
})
```

## POST /api/tracking/plans

```typescript
http.post(`${BASE}/plans`, async ({ request }) => {
  await delay(150)
  const body = await request.json()
  
  const parsed = trackingPlanSchema.safeParse(body)
  if (!parsed.success) {
    return HttpResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  
  const id = `plan-${Date.now()}`
  const plan = {
    ...parsed.data,
    id,
    version: 1,
    status: 'draft' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  
  plansDb.set(id, plan)
  auditDb.push({
    id: `audit-${Date.now()}`,
    planId: id,
    action: 'create',
    actorEmail: 'test@femiglow.ma',
    createdAt: new Date().toISOString(),
  })
  
  return HttpResponse.json(plan, { status: 201 })
})
```

## PATCH /api/tracking/plans/:id (optimistic concurrency)

```typescript
http.patch(`${BASE}/plans/:id`, async ({ params, request }) => {
  await delay(100)
  const body = await request.json()
  const id = params.id as string
  const plan = plansDb.get(id)
  
  if (!plan) {
    return HttpResponse.json({ error: 'plan_not_found' }, { status: 404 })
  }
  
  // Optimistic concurrency check
  if (typeof body.version === 'number' && body.version !== plan.version) {
    return HttpResponse.json(
      {
        error: 'version_conflict',
        currentVersion: plan.version,
        attemptedVersion: body.version,
        currentPlan: plan,
      },
      { status: 409 }
    )
  }
  
  const updated = {
    ...plan,
    ...body,
    id,
    version: plan.version + 1,
    updatedAt: new Date().toISOString(),
  }
  
  plansDb.set(id, updated)
  auditDb.push({
    id: `audit-${Date.now()}`,
    planId: id,
    action: 'update',
    actorEmail: 'test@femiglow.ma',
    createdAt: new Date().toISOString(),
  })
  
  return HttpResponse.json(updated)
})
```

## POST /api/tracking/plans/:id/activate

```typescript
http.post(`${BASE}/plans/:id/activate`, async ({ params }) => {
  await delay(250)
  const id = params.id as string
  const plan = plansDb.get(id)
  
  if (!plan) {
    return HttpResponse.json({ error: 'plan_not_found' }, { status: 404 })
  }
  
  if (plan.status === 'active') {
    return HttpResponse.json(
      { error: 'already_active' },
      { status: 400 }
    )
  }
  
  // Validation R-001
  const placeholder = /G-PROD0000|AW-REPLACE|GTM-PLACEHOLDER/
  const prodProfile = plan.envProfiles.find(e => e.env === 'production')
  if (prodProfile) {
    const configStr = JSON.stringify(prodProfile.config)
    if (placeholder.test(configStr)) {
      return HttpResponse.json(
        {
          error: 'validation_failed',
          code: 'R-001',
          message: 'Placeholder détecté en production',
        },
        { status: 400 }
      )
    }
  }
  
  // Archive previous active
  for (const [pid, p] of plansDb.entries()) {
    if (p.status === 'active') {
      plansDb.set(pid, { ...p, status: 'archived' })
      auditDb.push({
        id: `audit-${Date.now()}-a`,
        planId: pid,
        action: 'archive',
        actorEmail: 'test@femiglow.ma',
        createdAt: new Date().toISOString(),
      })
    }
  }
  
  const activated = { ...plan, status: 'active' as const, version: plan.version + 1 }
  plansDb.set(id, activated)
  auditDb.push({
    id: `audit-${Date.now()}-b`,
    planId: id,
    action: 'activate',
    actorEmail: 'test@femiglow.ma',
    createdAt: new Date().toISOString(),
  })
  
  return HttpResponse.json(activated)
})
```

## GET /api/tracking/plans/:id/export

```typescript
http.get(`${BASE}/plans/:id/export`, async ({ params, request }) => {
  await delay(180)
  const id = params.id as string
  const env = new URL(request.url).searchParams.get('env') || 'production'
  
  const plan = plansDb.get(id)
  if (!plan) {
    return HttpResponse.json({ error: 'plan_not_found' }, { status: 404 })
  }
  
  // Stub : retourne un GTM JSON structurel
  return HttpResponse.json({
    exportFormatVersion: 2,
    exportTime: '2026-05-14T10:00:00Z',  // fixed for determinism in tests
    containerVersion: {
      accountId: '6000000000',
      containerId: '999999',
      tag: plan.events.map((e, i) => ({
        accountId: '6000000000',
        containerId: '999999',
        tagId: String(i + 1),
        name: `GA4 - ${e.key}`,
        type: 'gaawe',
        parameter: [
          {
            type: 'TEMPLATE',
            key: 'eventName',
            value: e.key,
          },
        ],
      })),
      trigger: [],
      variable: [],
      builtInVariable: [
        { type: 'AD_STORAGE' },
        { type: 'ANALYTICS_STORAGE' },
      ],
    },
    _bundleId: 'mock-bundle-' + id + '-' + env,  // deterministic
  })
})
```

## GET /api/tracking/health

```typescript
http.get(`${BASE}/health`, async () => {
  await delay(40)
  return HttpResponse.json({
    status: 'ok',
    activePlanId: 'plan-active-prod-v8',
    clientBundleId: 'bundle-abc123',
    serverBundleId: 'bundle-abc123',
    drift: 'none',
    lastChecked: new Date().toISOString(),
  })
})
```

## GET /api/tracking/audit

```typescript
http.get(`${BASE}/audit`, async ({ request }) => {
  await delay(70)
  const planId = new URL(request.url).searchParams.get('planId')
  
  let entries = [...auditDb]
  if (planId) entries = entries.filter(a => a.planId === planId)
  
  return HttpResponse.json({
    data: entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    total: entries.length,
  })
})
```

## Handler error simulations

```typescript
// handlers/errors.ts (loadable per test)
export const errorHandlers = {
  serverError: http.get(`${BASE}/plans`, () =>
    HttpResponse.json({ error: 'internal' }, { status: 500 })
  ),
  
  expiredSession: http.all(`${BASE}/*`, () =>
    HttpResponse.json({ error: 'expired' }, { status: 401 })
  ),
  
  forbidden: http.post(`${BASE}/plans/*/activate`, () =>
    HttpResponse.json({ error: 'forbidden' }, { status: 403 })
  ),
  
  slowResponse: http.get(`${BASE}/plans`, async () => {
    await delay(5_000)
    return HttpResponse.json({ data: [], total: 0 })
  }),
  
  networkFail: http.get(`${BASE}/plans`, () => HttpResponse.error()),
}
```
