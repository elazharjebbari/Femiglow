# Tests cross-system (intégration intermédiaire)

Tests qui touchent 2-3 systèmes mais ne vont pas aussi loin que l'ultimate.

## Wizard ↔ API ↔ DB

```typescript
describe('Wizard → Plan persisté en DB', () => {
  it('création via wizard écrit en DB avec audit', async () => {
    await page.goto('/admin/tracking/new')
    
    // ... walk wizard ...
    await page.getByRole('button', { name: /Activer/ }).click()
    
    // Vérif DB directe
    const plansInDb = await testDb.select().from(trackingPlans)
    expect(plansInDb.length).toBe(1)
    expect(plansInDb[0].status).toBe('active')
    
    const audit = await testDb.select().from(trackingPlanAudit)
    expect(audit.length).toBe(2)  // create + activate
  })
})
```

## Validator ↔ Exporter

```typescript
describe('Validator → Exporter', () => {
  it('plan refusé par validator ne peut pas s\'exporter', async () => {
    const badPlan = buildPlan({
      envProfiles: [{ env: 'production', config: { ga4MeasurementId: 'G-PROD0000' } }]
    })
    
    expect(() => exportPlan(badPlan, 'production')).toThrow(/R-001/)
  })
  
  it('plan validé exporte avec succès', async () => {
    const goodPlan = buildPlan({})  // defaults are valid
    const result = exportPlan(goodPlan, 'production')
    expect(result.bundleId).toMatch(/^[a-f0-9]{64}$/)
  })
})
```

## Exporter ↔ Cache ↔ Healthcheck

```typescript
describe('Exporter → Cache → Healthcheck', () => {
  it('export caché et invalidé après update', async () => {
    const planId = (await createPlan()).id
    await activatePlan(planId)
    
    const exp1 = await fetch(`/api/tracking/plans/${planId}/export?env=production`).then(r => r.json())
    const bundle1 = exp1._bundleId
    
    // Update
    await updatePlan(planId, { events: [{ key: 'page_view', providers: { ga4: true } }] })
    
    const exp2 = await fetch(`/api/tracking/plans/${planId}/export?env=production`).then(r => r.json())
    const bundle2 = exp2._bundleId
    
    expect(bundle2).not.toBe(bundle1)
  })
})
```

## DB migration ↔ Repository

```typescript
describe('Legacy migration → new repo', () => {
  it('plan créé en legacy est lisible via le nouveau repo', async () => {
    // Insert directly in _legacy_v1 table
    await testDb.execute(sql`
      INSERT INTO tracking_tags_legacy_v1 (id, name, ga4_id, status)
      VALUES ('old-1', 'Plan ancien', 'G-OLDV1', 'active')
    `)
    
    // Run migration
    await runLegacyMigration()
    
    // Lire via le nouveau repo
    const migrated = await repo.findById('old-1-migrated')
    expect(migrated).toBeDefined()
    expect(migrated?.envProfiles[0].config.ga4MeasurementId).toBe('G-OLDV1')
  })
})
```

## Feature flag ↔ UI

```typescript
describe('Feature flag TRACKING_PLAN_V2_ENABLED', () => {
  it('flag off → UI legacy affichée', async () => {
    await setFeatureFlag('TRACKING_PLAN_V2_ENABLED', false)
    
    await page.goto('/admin/tracking')
    await expect(page.getByText(/Configuration legacy/)).toBeVisible()
  })
  
  it('flag on → wizard v2 affiché', async () => {
    await setFeatureFlag('TRACKING_PLAN_V2_ENABLED', true)
    
    await page.goto('/admin/tracking')
    await expect(page.getByRole('button', { name: /Nouveau plan/ })).toBeVisible()
  })
})
```

## i18n ↔ Validation errors

```typescript
describe('i18n × Validation', () => {
  it('messages d\'erreur traduits en arabe', async () => {
    const badPlan = buildPlan({
      envProfiles: [{ env: 'production', config: { ga4MeasurementId: 'G-PROD0000' } }]
    })
    
    const { errors } = validatePlan(badPlan, { locale: 'ar-MA' })
    expect(errors[0].message).toMatch(/قيمة تجريبية|placeholder/i)
  })
})
```
