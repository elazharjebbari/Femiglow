# Tests validator — Spec

Cible : `apps/web/src/lib/tracking/plan/validator.ts`

## Règles à tester

### R-001 — Refus des placeholders en production

```typescript
describe('validatePlan — R-001 placeholders', () => {
  it('rejects G-PROD0000 in production env', () => {
    const plan = buildPlan({
      envProfiles: [{
        env: 'production',
        config: { ga4MeasurementId: 'G-PROD0000' }
      }]
    })
    const result = validatePlan(plan)
    expect(result.errors).toContainEqual({
      code: 'R-001',
      path: 'envProfiles[0].config.ga4MeasurementId',
      message: expect.stringContaining('placeholder'),
    })
  })

  it('rejects AW-REPLACE_ME placeholder', () => {
    const plan = buildPlan({
      envProfiles: [{
        env: 'production',
        config: { googleAdsConversionId: 'AW-REPLACE_ME' }
      }]
    })
    expect(validatePlan(plan).errors).toHaveLength(1)
  })

  it('rejects GTM-PLACEHOLDER container ID', () => {
    const plan = buildPlan({
      envProfiles: [{
        env: 'production',
        config: { gtmContainerId: 'GTM-PLACEHOLDER' }
      }]
    })
    expect(validatePlan(plan).errors).toHaveLength(1)
  })

  it('accepts valid G-5VHP17SDZM in production', () => {
    const plan = buildPlan({
      envProfiles: [{
        env: 'production',
        config: { ga4MeasurementId: 'G-5VHP17SDZM' }
      }]
    })
    expect(validatePlan(plan).errors).toHaveLength(0)
  })

  it('warns but does not reject placeholder in staging env', () => {
    const plan = buildPlan({
      envProfiles: [
        { env: 'production', config: { ga4MeasurementId: 'G-5VHP17SDZM' } },
        { env: 'staging', config: { ga4MeasurementId: 'G-STAGING0000' } },
      ]
    })
    const result = validatePlan(plan)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'W-001' })
    )
  })
})
```

### R-002 — Au moins 1 provider actif

```typescript
describe('validatePlan — R-002 at least 1 provider', () => {
  it('rejects plan with 0 active providers', () => {
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: false },
        { id: 'meta', active: false },
      ]
    })
    expect(validatePlan(plan).errors).toContainEqual({
      code: 'R-002',
      message: expect.stringContaining('au moins un'),
    })
  })

  it('accepts plan with 1 active provider', () => {
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: true },
      ]
    })
    expect(validatePlan(plan).errors).toHaveLength(0)
  })
})
```

### R-003 — ID requis pour provider actif

```typescript
describe('validatePlan — R-003 IDs required for active provider', () => {
  it('rejects active GA4 without measurementId', () => {
    const plan = buildPlan({
      providers: [{ id: 'ga4', active: true }],
      envProfiles: [{
        env: 'production',
        config: {} // pas de ga4MeasurementId
      }]
    })
    expect(validatePlan(plan).errors).toContainEqual({
      code: 'R-003',
      path: 'envProfiles[0].config.ga4MeasurementId',
    })
  })

  it('inactive provider without ID OK', () => {
    const plan = buildPlan({
      providers: [
        { id: 'ga4', active: true },
        { id: 'tiktok', active: false },
      ],
      envProfiles: [{
        env: 'production',
        config: { ga4MeasurementId: 'G-VALID123' }
        // pas de tiktok config, c'est OK car inactif
      }]
    })
    expect(validatePlan(plan).errors).toHaveLength(0)
  })
})
```

### R-004 — Environment 'production' obligatoire

```typescript
describe('validatePlan — R-004 production env required', () => {
  it('rejects plan without production env profile', () => {
    const plan = buildPlan({
      envProfiles: [
        { env: 'staging', config: {} }
        // pas de production !
      ]
    })
    expect(validatePlan(plan).errors).toContainEqual({
      code: 'R-004',
    })
  })
})
```

### R-005 — Clés event uniques

```typescript
describe('validatePlan — R-005 unique event keys', () => {
  it('rejects duplicate event keys', () => {
    const plan = buildPlan({
      events: [
        { key: 'page_view', providers: { ga4: true } },
        { key: 'page_view', providers: { meta: true } }, // doublon !
      ]
    })
    expect(validatePlan(plan).errors).toContainEqual({
      code: 'R-005',
      path: 'events[1].key',
    })
  })

  it('accepts events with different keys', () => {
    const plan = buildPlan({
      events: [
        { key: 'page_view', providers: { ga4: true } },
        { key: 'purchase', providers: { ga4: true } },
      ]
    })
    expect(validatePlan(plan).errors).toHaveLength(0)
  })
})
```

## Warnings (non bloquants)

```typescript
describe('validatePlan — warnings', () => {
  it('warns on placeholder in non-production env', () => {
    // Voir R-001 above
  })

  it('warns on missing optional fields (analytics extra params)', () => {
    const plan = buildPlan({
      events: [{
        key: 'purchase',
        providers: { ga4: true },
        // pas de transaction_id en params - warning recommandé
      }]
    })
    const result = validatePlan(plan)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'W-002' })
    )
  })

  it('warns on hardcoded values that should be variables', () => {
    // ...
  })
})
```

## Edge cases

```typescript
describe('validatePlan — edge cases', () => {
  it('handles empty plan name', () => {
    // ...
  })

  it('handles unicode in plan name', () => {
    // ...
  })

  it('handles large event count (50+)', () => {
    // perf test : valider en < 100ms
  })

  it('handles malformed Zod input gracefully', () => {
    expect(() => validatePlan(null as any)).toThrow()
  })
})
```

## Helper buildPlan

```typescript
// tests/helpers/build-plan.ts
export function buildPlan(overrides: Partial<TrackingPlan>): TrackingPlan {
  return {
    id: 'plan-test-001',
    name: 'Test Plan',
    status: 'draft',
    version: 1,
    providers: [
      { id: 'ga4', active: true },
    ],
    envProfiles: [
      { env: 'production', config: { ga4MeasurementId: 'G-VALID1234' } },
    ],
    events: [],
    settings: {},
    createdBy: 'test@femiglow.ma',
    createdAt: new Date('2026-05-14'),
    updatedAt: new Date('2026-05-14'),
    ...overrides,
  }
}
```

## Couverture cible

- Statements : 95%
- Branches : 90%
- Functions : 100%
- Lines : 95%

Aucune branche de la fonction `validatePlan` non couverte.
