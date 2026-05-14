# Tests exporter — Spec

Cible : `apps/web/src/lib/tracking/plan/exporter.ts`

## Propriétés clés à tester

### Déterminisme

Critère le plus important : **le même plan + même env produit toujours le même JSON et le même bundleId**.

```typescript
describe('exportPlan — déterminisme', () => {
  it('produces identical output for same input', () => {
    const plan = loadFixture('valid-production-v8.json')
    const result1 = exportPlan(plan, 'production')
    const result2 = exportPlan(plan, 'production')
    expect(result1.json).toEqual(result2.json)
    expect(result1.bundleId).toBe(result2.bundleId)
  })

  it('produces identical bundleId across runs (clock independent)', () => {
    const plan = loadFixture('valid-production-v8.json')
    
    // Simulate first run
    const beforeRun1 = Date.now()
    const result1 = exportPlan(plan, 'production')
    
    // Simulate second run at later time
    jest.setSystemTime(beforeRun1 + 24 * 3600 * 1000)
    const result2 = exportPlan(plan, 'production')
    
    expect(result1.bundleId).toBe(result2.bundleId)
  })

  it('sorts keys alphabetically in output JSON', () => {
    const plan = buildPlan({
      providers: [{ id: 'tiktok', active: true }, { id: 'ga4', active: true }]
    })
    const result = exportPlan(plan, 'production')
    const jsonString = JSON.stringify(result.json)
    expect(jsonString.indexOf('"ga4"')).toBeLessThan(jsonString.indexOf('"tiktok"'))
  })

  it('strips non-deterministic fields (createdAt etc.)', () => {
    const plan1 = buildPlan({ createdAt: new Date('2026-01-01') })
    const plan2 = buildPlan({ createdAt: new Date('2026-05-14') })
    
    expect(exportPlan(plan1, 'production').bundleId)
      .toBe(exportPlan(plan2, 'production').bundleId)
  })
})
```

### Différenciation par environnement

```typescript
describe('exportPlan — multi-env', () => {
  it('production and staging produce different bundleIds', () => {
    const plan = loadFixture('multi-env-staging.json')
    const prod = exportPlan(plan, 'production')
    const stag = exportPlan(plan, 'staging')
    expect(prod.bundleId).not.toBe(stag.bundleId)
  })

  it('production env profile is used for production export', () => {
    const plan = buildPlan({
      envProfiles: [
        { env: 'production', config: { ga4MeasurementId: 'G-PROD123' } },
        { env: 'staging', config: { ga4MeasurementId: 'G-STAG456' } },
      ]
    })
    const result = exportPlan(plan, 'production')
    expect(JSON.stringify(result.json)).toContain('G-PROD123')
    expect(JSON.stringify(result.json)).not.toContain('G-STAG456')
  })
})
```

### Structure du JSON GTM

```typescript
describe('exportPlan — structure GTM', () => {
  it('produces valid GTM container JSON', () => {
    const plan = loadFixture('valid-production-v8.json')
    const result = exportPlan(plan, 'production')
    
    expect(result.json).toMatchObject({
      exportFormatVersion: 2,
      containerVersion: {
        accountId: expect.any(String),
        containerId: expect.any(String),
        tag: expect.any(Array),
        trigger: expect.any(Array),
        variable: expect.any(Array),
      }
    })
  })

  it('contains GA4 tag when GA4 provider active', () => {
    const plan = buildPlan({
      providers: [{ id: 'ga4', active: true }],
      events: [{ key: 'page_view', providers: { ga4: true } }]
    })
    const result = exportPlan(plan, 'production')
    const tags = result.json.containerVersion.tag
    expect(tags).toContainEqual(
      expect.objectContaining({
        type: 'gaawe',  // GA4 Event
      })
    )
  })

  it('does NOT contain GA4 tag when GA4 inactive', () => {
    const plan = buildPlan({
      providers: [{ id: 'ga4', active: false }],
      events: []
    })
    const result = exportPlan(plan, 'production')
    const tags = result.json.containerVersion.tag
    expect(tags.filter((t: any) => t.type === 'gaawe')).toHaveLength(0)
  })

  it('uses CONST variables for IDs (not hardcoded in tags)', () => {
    const plan = loadFixture('valid-production-v8.json')
    const result = exportPlan(plan, 'production')
    
    const variables = result.json.containerVersion.variable
    expect(variables).toContainEqual(
      expect.objectContaining({
        type: 'c',  // CONST
        name: expect.stringMatching(/CONST - GA4 Measurement ID/),
      })
    )
  })

  it('all event tags reference variables via {{CONST - ...}}', () => {
    const plan = loadFixture('valid-production-v8.json')
    const result = exportPlan(plan, 'production')
    
    const ga4Tags = result.json.containerVersion.tag.filter(
      (t: any) => t.type === 'gaawe'
    )
    
    for (const tag of ga4Tags) {
      const measurementIdParam = tag.parameter.find(
        (p: any) => p.key === 'measurementId'
      )
      expect(measurementIdParam.value).toMatch(/^\{\{CONST/)
    }
  })
})
```

### Consent Mode v2

```typescript
describe('exportPlan — consent mode v2', () => {
  it('adds consent built-in variables', () => {
    const plan = loadFixture('valid-production-v8.json')
    const result = exportPlan(plan, 'production')
    
    expect(result.json.containerVersion.builtInVariable).toContainEqual(
      expect.objectContaining({ type: 'AD_STORAGE' })
    )
    expect(result.json.containerVersion.builtInVariable).toContainEqual(
      expect.objectContaining({ type: 'ANALYTICS_STORAGE' })
    )
  })

  it('GA4 tags include consent triggers', () => {
    const plan = loadFixture('valid-production-v8.json')
    const result = exportPlan(plan, 'production')
    const ga4Tag = result.json.containerVersion.tag.find(
      (t: any) => t.type === 'gaawe'
    )
    expect(ga4Tag.consentSettings).toBeDefined()
  })
})
```

### Snapshots

```typescript
describe('exportPlan — snapshots', () => {
  it('export matches snapshot for production v8 fixture', () => {
    const plan = loadFixture('valid-production-v8.json')
    const result = exportPlan(plan, 'production')
    expect(result.json).toMatchSnapshot()
  })

  it('export matches snapshot for staging variant', () => {
    const plan = loadFixture('multi-env-staging.json')
    const result = exportPlan(plan, 'staging')
    expect(result.json).toMatchSnapshot()
  })

  it('bundle hash matches expected value', () => {
    const plan = loadFixture('valid-production-v8.json')
    const result = exportPlan(plan, 'production')
    
    // Hash écrit explicitement (peer reviewed)
    expect(result.bundleId).toBe('4dc5e8a7b3f8e2c1...')  // 64 char hex
  })
})
```

### Empty / edge cases

```typescript
describe('exportPlan — edge cases', () => {
  it('handles plan with 0 events (valid)', () => {
    const plan = buildPlan({ events: [] })
    const result = exportPlan(plan, 'production')
    expect(result.json.containerVersion.tag.filter(
      (t: any) => t.type !== 'cl' // exclude default tags
    )).toHaveLength(0)
  })

  it('handles plan with 30+ events (performance)', () => {
    const plan = buildPlan({
      events: Array.from({ length: 30 }, (_, i) => ({
        key: `event_${i}`,
        providers: { ga4: true }
      }))
    })
    const start = performance.now()
    exportPlan(plan, 'production')
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(50)  // < 50ms
  })

  it('throws if env not in plan profiles', () => {
    const plan = buildPlan({
      envProfiles: [{ env: 'production', config: {} }]
    })
    expect(() => exportPlan(plan, 'staging' as any))
      .toThrow(/staging.*not found/)
  })
})
```

## Helper loadFixture

```typescript
// tests/helpers/load-fixture.ts
import { readFileSync } from 'fs'
import { join } from 'path'

export function loadFixture(name: string): TrackingPlan {
  const path = join(__dirname, '../fixtures/tracking-plans', name)
  return JSON.parse(readFileSync(path, 'utf-8'))
}
```

## Mocks et timing

```typescript
beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-05-14T10:00:00Z'))
})

afterEach(() => {
  jest.useRealTimers()
})
```

## Couverture cible

- Statements : 90%
- Branches : 85%
- Functions : 95%
- Lines : 90%
