# Tests migration legacy v1 → v2

## Pré-conditions

- Tables `tracking_tags_legacy_v1`, `pixel_config_legacy_v1`, `gtm_export_legacy_v1` peuplées avec données réelles d'avant migration.
- Script de migration `scripts/migrate-legacy-to-v2.ts` exécutable.

## Dry-run

```typescript
describe('Migration dry-run', () => {
  it('rapporte les 3 systèmes legacy à migrer sans modifier la DB', async () => {
    const initialPlansV2 = await testDb.select({ count: count() }).from(trackingPlans)
    
    const report = await runMigration({ dryRun: true })
    
    expect(report).toMatchObject({
      legacySystems: 3,
      legacyEntries: expect.any(Number),
      mappedToV2: expect.any(Number),
      conflicts: expect.any(Array),
    })
    
    // Pas d'écriture en DB
    const afterPlansV2 = await testDb.select({ count: count() }).from(trackingPlans)
    expect(afterPlansV2[0].count).toBe(initialPlansV2[0].count)
  })
  
  it('détecte les conflits (mêmes IDs dans plusieurs systèmes)', async () => {
    // Setup : même GA4 ID dans tags_legacy ET pixel_config_legacy
    await testDb.execute(sql`
      INSERT INTO tracking_tags_legacy_v1 (id, ga4_id) VALUES ('a', 'G-DUP')
    `)
    await testDb.execute(sql`
      INSERT INTO pixel_config_legacy_v1 (id, ga4_id) VALUES ('b', 'G-DUP')
    `)
    
    const report = await runMigration({ dryRun: true })
    expect(report.conflicts.length).toBeGreaterThan(0)
    expect(report.conflicts[0]).toMatchObject({
      key: 'G-DUP',
      sources: expect.arrayContaining(['tracking_tags', 'pixel_config']),
    })
  })
})
```

## Migration réelle

```typescript
describe('Migration apply', () => {
  it('migre toutes les entrées legacy en plans v2', async () => {
    // Seed legacy
    await seedLegacy({
      tags: 5,
      pixels: 3,
      gtmExports: 2,
    })
    
    const report = await runMigration({ dryRun: false })
    
    expect(report.success).toBe(true)
    expect(report.legacyEntries).toBe(10)
    
    // Vérif côté v2
    const v2Plans = await testDb.select().from(trackingPlans)
    expect(v2Plans.length).toBeGreaterThan(0)
    
    // Au moins 1 plan actif (le plus récent legacy)
    const active = v2Plans.filter(p => p.status === 'active')
    expect(active.length).toBe(1)
  })
  
  it('rejoue idempotent : 2e exécution ne crée rien', async () => {
    await seedLegacy({ tags: 3 })
    await runMigration({ dryRun: false })
    
    const count1 = (await testDb.select({ c: count() }).from(trackingPlans))[0].c
    
    await runMigration({ dryRun: false })
    
    const count2 = (await testDb.select({ c: count() }).from(trackingPlans))[0].c
    expect(count2).toBe(count1)
  })
  
  it('conserve les données legacy après migration (T+90)', async () => {
    await seedLegacy({ tags: 5 })
    await runMigration({ dryRun: false })
    
    // Legacy tables encore là
    const legacy = await testDb.execute(sql`SELECT count(*) FROM tracking_tags_legacy_v1`)
    expect(legacy.rows[0].count).toBe('5')
  })
})
```

## Rollback migration

```typescript
describe('Migration rollback', () => {
  it('rollback restore l\'état pré-migration', async () => {
    await seedLegacy({ tags: 5 })
    const beforeMigration = await snapshotDb()
    
    await runMigration({ dryRun: false })
    
    await rollbackMigration()
    
    const afterRollback = await snapshotDb()
    expect(afterRollback).toEqual(beforeMigration)
  })
})
```

## Compatibilité runtime

```typescript
describe('Coexistence legacy + v2 pendant rollout', () => {
  it('flag off : runtime client lit legacy', async () => {
    await setFeatureFlag('TRACKING_PLAN_V2_ENABLED', false)
    
    const config = await fetch('/api/tracking/runtime-config').then(r => r.json())
    expect(config.source).toBe('legacy')
  })
  
  it('flag on : runtime client lit v2', async () => {
    await setFeatureFlag('TRACKING_PLAN_V2_ENABLED', true)
    
    const config = await fetch('/api/tracking/runtime-config').then(r => r.json())
    expect(config.source).toBe('v2')
    expect(config.bundleId).toMatch(/^[a-f0-9]{64}$/)
  })
})
```
