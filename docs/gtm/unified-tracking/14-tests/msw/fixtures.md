# Fixtures MSW

Stocks en mémoire utilisés par les handlers, réinitialisés entre tests via `server.resetHandlers()`.

## tracking-store.ts

```typescript
// apps/web/src/mocks/fixtures/tracking-store.ts
import type { TrackingPlan, AuditEntry } from '@/lib/tracking/plan/types'

export const plansDb = new Map<string, TrackingPlan>()
export const auditDb: AuditEntry[] = []

export function resetStores() {
  plansDb.clear()
  auditDb.length = 0
  seedDefault()
}

function seedDefault() {
  // Plan actif Production v8
  plansDb.set('plan-active-prod-v8', {
    id: 'plan-active-prod-v8',
    name: 'Production v8',
    status: 'active',
    version: 8,
    providers: [
      { id: 'ga4', active: true },
      { id: 'googleAds', active: true },
      { id: 'meta', active: true },
    ],
    envProfiles: [
      {
        env: 'production',
        config: {
          ga4MeasurementId: 'G-5VHP17SDZM',
          googleAdsConversionId: 'AW-987654321',
          metaPixelId: '1234567890123456',
          gtmContainerId: 'GTM-M8K7V88D',
        },
      },
      {
        env: 'staging',
        config: { ga4MeasurementId: 'G-STAGING5VHP' },
      },
    ],
    events: [
      { key: 'page_view', label: 'Page vue', providers: { ga4: true, meta: true } },
      { key: 'purchase', label: 'Achat', providers: { ga4: true, googleAds: true, meta: true } },
      { key: 'add_to_cart', label: 'Ajout panier', providers: { ga4: true, meta: true } },
    ],
    settings: {
      consentMode: 'v2',
      consentDefaults: { ad_storage: 'denied', analytics_storage: 'denied' },
    },
    createdBy: 'amal@femiglow.ma',
    createdAt: '2026-05-12T14:21:00Z',
    updatedAt: '2026-05-12T14:21:00Z',
  })
  
  // Brouillon prêt
  plansDb.set('plan-draft-ready', {
    id: 'plan-draft-ready',
    name: 'Brouillon prêt',
    status: 'draft',
    version: 1,
    providers: [{ id: 'ga4', active: true }],
    envProfiles: [{
      env: 'production',
      config: { ga4MeasurementId: 'G-NEW9876543' },
    }],
    events: [
      { key: 'page_view', providers: { ga4: true } },
    ],
    settings: { consentMode: 'v2' },
    createdBy: 'amal@femiglow.ma',
    createdAt: '2026-05-14T08:00:00Z',
    updatedAt: '2026-05-14T08:30:00Z',
  })
  
  // Brouillon avec placeholder (R-001)
  plansDb.set('plan-draft-bad', {
    id: 'plan-draft-bad',
    name: 'Brouillon problématique',
    status: 'draft',
    version: 1,
    providers: [{ id: 'ga4', active: true }],
    envProfiles: [{
      env: 'production',
      config: { ga4MeasurementId: 'G-PROD0000' },  // placeholder !
    }],
    events: [],
    settings: {},
    createdBy: 'younes@femiglow.ma',
    createdAt: '2026-05-14T09:00:00Z',
    updatedAt: '2026-05-14T09:00:00Z',
  })
  
  // Plan archivé v7
  plansDb.set('plan-archived-v7', {
    id: 'plan-archived-v7',
    name: 'Production v7',
    status: 'archived',
    version: 7,
    providers: [{ id: 'ga4', active: true }],
    envProfiles: [{
      env: 'production',
      config: { ga4MeasurementId: 'G-OLDV7CONFIG' },
    }],
    events: [{ key: 'page_view', providers: { ga4: true } }],
    settings: {},
    createdBy: 'amal@femiglow.ma',
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-05-12T14:21:00Z',
  })
  
  // Audit baseline
  auditDb.push(
    {
      id: 'audit-1',
      planId: 'plan-archived-v7',
      action: 'create',
      actorEmail: 'amal@femiglow.ma',
      createdAt: '2026-04-01T10:00:00Z',
    },
    {
      id: 'audit-2',
      planId: 'plan-archived-v7',
      action: 'activate',
      actorEmail: 'amal@femiglow.ma',
      createdAt: '2026-04-01T10:30:00Z',
    },
    {
      id: 'audit-3',
      planId: 'plan-active-prod-v8',
      action: 'create',
      actorEmail: 'amal@femiglow.ma',
      createdAt: '2026-05-12T14:21:00Z',
    },
    {
      id: 'audit-4',
      planId: 'plan-active-prod-v8',
      action: 'activate',
      actorEmail: 'amal@femiglow.ma',
      createdAt: '2026-05-12T14:30:00Z',
    },
    {
      id: 'audit-5',
      planId: 'plan-archived-v7',
      action: 'archive',
      actorEmail: 'amal@femiglow.ma',
      createdAt: '2026-05-12T14:30:00Z',
    }
  )
}

// Initial seed
seedDefault()
```

## Factories pour tests spécifiques

```typescript
// apps/web/src/mocks/factories/plan.ts

export function makePlan(overrides: Partial<TrackingPlan> = {}): TrackingPlan {
  return {
    id: `plan-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Test Plan',
    status: 'draft',
    version: 1,
    providers: [{ id: 'ga4', active: true }],
    envProfiles: [{ env: 'production', config: { ga4MeasurementId: 'G-VALID1234' } }],
    events: [],
    settings: { consentMode: 'v2' },
    createdBy: 'test@femiglow.ma',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function makePlanWithEvents(count: number): TrackingPlan {
  return makePlan({
    events: Array.from({ length: count }, (_, i) => ({
      key: `event_${i}`,
      label: `Event ${i}`,
      providers: { ga4: true },
    })),
  })
}

export function makePlanWithPlaceholder(): TrackingPlan {
  return makePlan({
    envProfiles: [{
      env: 'production',
      config: { ga4MeasurementId: 'G-PROD0000' },
    }],
  })
}
```
