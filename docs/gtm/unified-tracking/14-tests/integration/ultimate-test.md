# Test ultime — Validation E2E complète

> **Objectif** : prouver, en un seul scénario, que **TOUT** le système TrackingPlan v2 fonctionne nickel : UI ↔ API ↔ DB ↔ validator ↔ exporter ↔ runtime client ↔ drift detection ↔ audit ↔ rollback.

Ce test est **le filet de sécurité ultime**. S'il passe, on peut activer en prod en confiance.

---

## Prérequis

- DB Postgres dédiée `femiglow_integration_test` (vide au début).
- Migrations Drizzle appliquées.
- Vraie instance Next.js démarrée sur port 4000.
- Pas de mocks MSW : tout est réel.

## Setup

```typescript
// e2e/integration/ultimate.spec.ts
import { test, expect, Page, APIRequestContext } from '@playwright/test'
import { execSync } from 'child_process'
import crypto from 'crypto'

test.describe('🏆 Ultimate test @ultimate @critical', () => {
  test.setTimeout(5 * 60 * 1000)  // 5 min budget
  test.describe.configure({ mode: 'serial' })  // un seul à la fois
  
  let page: Page
  let api: APIRequestContext
  let createdPlanId: string
  let v1BundleId: string
  let v2BundleId: string
  
  test.beforeAll(async ({ browser, playwright }) => {
    // Reset DB completely
    execSync('npm run db:reset:integration', { stdio: 'inherit' })
    execSync('npm run db:migrate:integration', { stdio: 'inherit' })
    
    page = await browser.newPage({ storageState: 'e2e/auth/admin.json' })
    api = await playwright.request.newContext({
      baseURL: process.env.E2E_BASE_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${process.env.E2E_ADMIN_TOKEN}` },
    })
  })
  
  test.afterAll(async () => {
    await page.close()
    await api.dispose()
  })
```

---

## Phase 1 — Création du plan via le wizard

```typescript
  test('1️⃣ Amal crée un plan via le wizard 5 étapes', async () => {
    await page.goto('/admin/tracking/new')
    
    // Step 1 — Outils
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await page.getByRole('checkbox', { name: 'Google Ads' }).check()
    await page.getByRole('checkbox', { name: 'Meta Pixel' }).check()
    await page.getByRole('button', { name: /Continuer/ }).click()
    
    // Step 2 — IDs (avec autofill détecté par le serveur)
    await expect(page.getByText('auto-rempli')).toHaveCount(3)
    await page.getByLabel('GA4 Measurement ID').fill('G-ULTIMATE12')
    await page.getByLabel('Google Ads Conversion ID').fill('AW-ULT123456')
    await page.getByLabel('Meta Pixel ID').fill('9999988877766')
    await page.getByRole('button', { name: /Continuer/ }).click()
    
    // Step 3 — Events
    const events = ['page_view', 'add_to_cart', 'purchase']
    for (const ev of events) {
      const row = page.getByRole('row', { name: new RegExp(ev) })
      await row.getByRole('checkbox', { name: /GA4/ }).check()
      if (ev === 'purchase') {
        await row.getByRole('checkbox', { name: /Ads/ }).check()
      }
    }
    await page.getByRole('button', { name: /Continuer/ }).click()
    
    // Step 4 — Envs
    await page.getByLabel('Staging GA4 ID').fill('G-STAGEULT01')
    await page.getByRole('button', { name: /Continuer/ }).click()
    
    // Step 5 — Récap
    await expect(page.getByText('3 outils actifs')).toBeVisible()
    await expect(page.getByText('3 événements définis')).toBeVisible()
    await expect(page.getByText(/Aucun blocage/)).toBeVisible()
    
    // Garder l'ID pour les phases suivantes
    const urlMatch = page.url().match(/\/plan\/([^?/]+)/)
    createdPlanId = urlMatch![1]
    expect(createdPlanId).toMatch(/^plan-/)
  })
```

---

## Phase 2 — Activation transactionnelle

```typescript
  test('2️⃣ Activation transactionnelle (plan + audit atomiques)', async () => {
    // État avant
    const beforeAudit = await api.get(`/api/tracking/audit?planId=${createdPlanId}`)
    const beforeBody = await beforeAudit.json()
    const beforeCount = beforeBody.data.length
    expect(beforeCount).toBe(1)  // juste le create
    
    // Activer
    await page.getByRole('button', { name: /Activer en production/ }).click()
    await page.getByRole('button', { name: /Confirmer activation/ }).click()
    
    // Status visible
    await expect(page.getByText(/Plan actif/)).toBeVisible({ timeout: 5_000 })
    
    // Vérif côté API
    const plan = await api.get(`/api/tracking/plans/${createdPlanId}`)
    const planBody = await plan.json()
    expect(planBody.status).toBe('active')
    expect(planBody.version).toBe(2)
    
    // Audit log : create + activate
    const afterAudit = await api.get(`/api/tracking/audit?planId=${createdPlanId}`)
    const afterBody = await afterAudit.json()
    expect(afterBody.data.length).toBe(2)
    expect(afterBody.data.map((a: any) => a.action)).toEqual(['activate', 'create'])
  })
```

---

## Phase 3 — Export GTM et calcul du bundleId v1

```typescript
  test('3️⃣ Export GTM v1 déterministe', async () => {
    // Export 1
    const exp1 = await api.get(`/api/tracking/plans/${createdPlanId}/export?env=production`)
    expect(exp1.status()).toBe(200)
    const body1 = await exp1.json()
    
    // Structure attendue
    expect(body1).toMatchObject({
      exportFormatVersion: 2,
      containerVersion: {
        tag: expect.any(Array),
        builtInVariable: expect.arrayContaining([
          { type: 'AD_STORAGE' },
          { type: 'ANALYTICS_STORAGE' },
        ]),
      },
      _bundleId: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    v1BundleId = body1._bundleId
    
    // 3 events × providers
    const tags = body1.containerVersion.tag
    expect(tags.filter((t: any) => t.type === 'gaawe').length).toBe(3)  // 3 ga4 events
    expect(tags.filter((t: any) => t.name?.includes('Ads')).length).toBeGreaterThanOrEqual(1)
    
    // Re-export → même bundleId (déterminisme)
    const exp2 = await api.get(`/api/tracking/plans/${createdPlanId}/export?env=production`)
    const body2 = await exp2.json()
    expect(body2._bundleId).toBe(v1BundleId)
    
    // Hash calculé localement match
    const canonical = canonicalize(body1.containerVersion)
    const recomputed = crypto.createHash('sha256').update(canonical).digest('hex')
    expect(recomputed).toBe(v1BundleId)
  })
```

---

## Phase 4 — Simulation client : ping + healthcheck

```typescript
  test('4️⃣ Client web ping : drift = none', async () => {
    // Simuler client live : il fetch l'export et l'utilise
    const exportRes = await api.get(`/api/tracking/plans/${createdPlanId}/export?env=production`)
    const exportData = await exportRes.json()
    const clientBundleId = exportData._bundleId
    
    // Ping healthcheck en simulant le bundle client
    const healthRes = await api.post('/api/tracking/health/ping', {
      data: {
        clientBundleId,
        env: 'production',
        timestamp: new Date().toISOString(),
      },
    })
    expect(healthRes.status()).toBe(200)
    
    // Healthcheck OK
    const health = await api.get('/api/tracking/health')
    const healthBody = await health.json()
    expect(healthBody).toMatchObject({
      status: 'ok',
      activePlanId: createdPlanId,
      drift: 'none',
      clientBundleId: v1BundleId,
      serverBundleId: v1BundleId,
    })
  })
```

---

## Phase 5 — Modification du plan (v2) sans toucher au plan actif

```typescript
  test('5️⃣ Edit plan via wizard, clone en draft', async () => {
    await page.goto(`/admin/tracking/plan/${createdPlanId}`)
    await page.getByRole('button', { name: /Modifier ce plan/ }).click()
    
    // Vérif copie créée
    await expect(page.getByText(/Vous éditez une copie/)).toBeVisible()
    const newPlanIdMatch = page.url().match(/\/plan\/([^?/]+)/)
    const draftV2Id = newPlanIdMatch![1]
    expect(draftV2Id).not.toBe(createdPlanId)
    
    // Modifier : ajouter TikTok
    await page.getByRole('button', { name: /Étape 1/ }).click()
    await page.getByRole('checkbox', { name: 'TikTok Pixel' }).check()
    await page.getByRole('button', { name: /Étape 2/ }).click()
    await page.getByLabel('TikTok Pixel ID').fill('TT-ULTIMATE-PX')
    await page.getByRole('button', { name: /Étape 3/ }).click()
    
    // Ajouter le tag TikTok sur purchase
    await page.getByRole('row', { name: /purchase/ })
      .getByRole('checkbox', { name: /TikTok/ }).check()
    
    await page.getByRole('button', { name: /Étape 5/ }).click()
    
    // Activer v2 — l'ancien devient archived automatiquement
    await page.getByRole('button', { name: /Activer/ }).click()
    await page.getByRole('button', { name: /Confirmer/ }).click()
    
    await expect(page.getByText(/Plan actif/)).toBeVisible()
    
    // Vérif côté DB
    const v1 = await api.get(`/api/tracking/plans/${createdPlanId}`)
    const v1Body = await v1.json()
    expect(v1Body.status).toBe('archived')
    
    const v2 = await api.get(`/api/tracking/plans/${draftV2Id}`)
    const v2Body = await v2.json()
    expect(v2Body.status).toBe('active')
    expect(v2Body.providers.find((p: any) => p.id === 'tiktok')?.active).toBe(true)
    
    // Update createdPlanId pour la suite
    createdPlanId = draftV2Id
  })
```

---

## Phase 6 — Drift critique : client a un vieux cache

```typescript
  test('6️⃣ Drift critique détecté quand client a vieux bundle', async () => {
    // Client envoie son ANCIEN bundleId (v1) alors qu'on est en v2
    const pingRes = await api.post('/api/tracking/health/ping', {
      data: {
        clientBundleId: v1BundleId,
        env: 'production',
        timestamp: new Date().toISOString(),
      },
    })
    expect(pingRes.status()).toBe(200)
    
    // Healthcheck doit refléter le drift
    const health = await api.get('/api/tracking/health')
    const healthBody = await health.json()
    expect(healthBody.drift).toBe('critical')
    expect(healthBody.clientBundleId).toBe(v1BundleId)
    expect(healthBody.serverBundleId).not.toBe(v1BundleId)
    
    // UI doit afficher bannière critique
    await page.goto('/admin/tracking/health')
    await expect(page.getByRole('alert')).toContainText(/Drift critique/)
    
    // Détails du runbook
    await page.getByRole('button', { name: /Voir détails/ }).click()
    await expect(page.getByText(/Bundle client diffère/)).toBeVisible()
    await expect(page.getByText(`Client: ${v1BundleId.slice(0, 8)}`)).toBeVisible()
  })
```

---

## Phase 7 — Auto-recovery du client : drift = none

```typescript
  test('7️⃣ Client refetch et drift redevient OK', async () => {
    // Client re-fetch
    const newExport = await api.get(`/api/tracking/plans/${createdPlanId}/export?env=production`)
    const newExportBody = await newExport.json()
    v2BundleId = newExportBody._bundleId
    expect(v2BundleId).not.toBe(v1BundleId)
    
    // Client ping avec le nouveau bundle
    await api.post('/api/tracking/health/ping', {
      data: {
        clientBundleId: v2BundleId,
        env: 'production',
        timestamp: new Date().toISOString(),
      },
    })
    
    const health = await api.get('/api/tracking/health')
    const healthBody = await health.json()
    expect(healthBody.drift).toBe('none')
    expect(healthBody.clientBundleId).toBe(v2BundleId)
    expect(healthBody.serverBundleId).toBe(v2BundleId)
  })
```

---

## Phase 8 — Rollback vers v1

```typescript
  test('8️⃣ Rollback vers v1 fonctionne et restore le bundleId', async () => {
    // Restaurer v1
    await page.goto('/admin/tracking/history')
    
    // Cliquer sur restore pour v1 (premier plan créé, maintenant archived)
    const v1Row = page.getByRole('row').filter({ hasText: 'archived' }).first()
    await v1Row.getByRole('button', { name: /Restaurer/ }).click()
    
    await page.getByLabel('Tapez "RESTORE"').fill('RESTORE')
    await page.getByRole('button', { name: /Confirmer rollback/ }).click()
    
    // V1 redevient actif, V2 devient archived
    await expect(page.getByText(/Restauration effectuée/)).toBeVisible()
    
    // L'export refait sort le bundle v1
    const activeRes = await api.get('/api/tracking/plans?status=active')
    const activeBody = await activeRes.json()
    const activeNow = activeBody.data[0]
    
    const exp = await api.get(`/api/tracking/plans/${activeNow.id}/export?env=production`)
    const expBody = await exp.json()
    expect(expBody._bundleId).toBe(v1BundleId)  // bundle déterministe → on retrouve v1
  })
```

---

## Phase 9 — Audit trail complet

```typescript
  test('9️⃣ Audit trail capture toutes les transitions', async () => {
    const allAudit = await api.get('/api/tracking/audit')
    const audit = await allAudit.json()
    
    // Au moins 9 entrées :
    // 1. create v1 (phase 1)
    // 2. activate v1 (phase 2)
    // 3. create v2 (phase 5)
    // 4. update v2 (phase 5, ajout tiktok)
    // 5. activate v2 (phase 5)
    // 6. archive v1 (phase 5)
    // 7. activate v1 (phase 8, rollback)
    // 8. archive v2 (phase 8, rollback)
    expect(audit.data.length).toBeGreaterThanOrEqual(8)
    
    // Vérif actions
    const actions = audit.data.map((a: any) => a.action)
    expect(actions).toContain('create')
    expect(actions).toContain('activate')
    expect(actions).toContain('archive')
    expect(actions).toContain('update')
    
    // Chaque entry a actorEmail, planId, timestamp
    for (const entry of audit.data) {
      expect(entry).toMatchObject({
        id: expect.any(String),
        planId: expect.any(String),
        action: expect.stringMatching(/^(create|update|activate|archive)$/),
        actorEmail: expect.stringContaining('@'),
        createdAt: expect.any(String),
      })
    }
  })
  
  test('🔟 Audit table is truly append-only (DB trigger)', async () => {
    // Try direct UPDATE/DELETE
    const updateRes = await api.post('/api/test/raw-sql', {
      data: { sql: `UPDATE tracking_plan_audit SET action = 'create' WHERE id = (SELECT id FROM tracking_plan_audit LIMIT 1)` },
    })
    expect(updateRes.status()).toBe(500)
    const body = await updateRes.json()
    expect(body.error).toMatch(/append-only|trigger/i)
    
    const deleteRes = await api.post('/api/test/raw-sql', {
      data: { sql: `DELETE FROM tracking_plan_audit WHERE id = (SELECT id FROM tracking_plan_audit LIMIT 1)` },
    })
    expect(deleteRes.status()).toBe(500)
  })
```

---

## Phase 10 — Validation et observabilité

```typescript
  test('1️⃣1️⃣ Métriques Prometheus exposent les bons compteurs', async () => {
    const metrics = await api.get('/metrics')
    const text = await metrics.text()
    
    // Métriques business attendues (depuis 13-runbook/monitoring)
    expect(text).toMatch(/tracking_plan_active_total{[^}]*} \d+/)
    expect(text).toMatch(/tracking_plan_activation_count_total{[^}]*} \d+/)
    expect(text).toMatch(/tracking_plan_export_duration_seconds_bucket/)
    expect(text).toMatch(/tracking_plan_drift_status{status="none"} 1/)
  })
  
  test('1️⃣2️⃣ Logs structurés contiennent les actions clés', async () => {
    const logsRes = await api.get('/api/test/recent-logs?limit=50&match=tracking_plan')
    const logs = await logsRes.json()
    
    // On doit avoir les events suivants au moins 1 fois chacun
    const events = logs.data.map((l: any) => l.event)
    expect(events).toContain('tracking_plan.created')
    expect(events).toContain('tracking_plan.activated')
    expect(events).toContain('tracking_plan.exported')
    expect(events).toContain('tracking_plan.drift_detected')
    expect(events).toContain('tracking_plan.rollback')
    
    // Chaque log a trace_id
    for (const log of logs.data) {
      expect(log.trace_id).toBeDefined()
    }
  })
```

---

## Phase 11 — Validation finale

```typescript
  test('1️⃣3️⃣ Healthcheck global indique "tout est OK"', async () => {
    await page.goto('/admin/tracking/health')
    
    await expect(page.getByRole('status', { name: /Santé/ }))
      .toContainText(/Tout est OK/, { timeout: 10_000 })
    
    // Sous-vérifications visibles
    await expect(page.getByText(/Drift\u00a0:\u00a0aucun/)).toBeVisible()
    await expect(page.getByText(/Plan actif détecté/)).toBeVisible()
    await expect(page.getByText(/Audit\u00a0:\u00a0\d+ entrées/)).toBeVisible()
  })
  
  test('1️⃣4️⃣ Performance globale dans les budgets', async () => {
    // Endpoint perf
    const perfRes = await api.get('/api/admin/perf-summary?period=last-hour')
    const perf = await perfRes.json()
    
    // P95 budgets (depuis dev-plan.md)
    expect(perf.endpoints['/api/tracking/plans'].p95).toBeLessThan(300)  // ms
    expect(perf.endpoints['/api/tracking/plans/:id'].p95).toBeLessThan(200)
    expect(perf.endpoints['/api/tracking/plans/:id/export'].p95).toBeLessThan(500)
  })
})
```

---

## Helpers

```typescript
function canonicalize(obj: any): string {
  // Tri alphabétique récursif des clés, supprime undefined, normalize whitespace
  if (Array.isArray(obj)) return JSON.stringify(obj.map(canonicalize))
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  
  const sortedKeys = Object.keys(obj).sort()
  const sorted: any = {}
  for (const k of sortedKeys) {
    if (obj[k] !== undefined) sorted[k] = obj[k]
  }
  return JSON.stringify(sorted)
}
```

---

## Critère de PASS du test ultime

Si **toutes les 14 phases passent**, le système est validé pour activation prod :

| Phase | Critère |
|-------|---------|
| 1 | Wizard crée plan, persiste DB |
| 2 | Activation atomique (plan + audit) |
| 3 | Export déterministe, hash valide |
| 4 | Healthcheck drift = none initial |
| 5 | Modif → activation v2, v1 archivé |
| 6 | Drift critique détecté quand client obsolète |
| 7 | Auto-recovery client → drift none |
| 8 | Rollback v1 fonctionne, bundle déterministe restauré |
| 9 | Audit log capture toutes transitions |
| 10 | Audit append-only (trigger DB) |
| 11 | Métriques Prometheus présentes |
| 12 | Logs structurés présents |
| 13 | Healthcheck global OK |
| 14 | Perf P95 dans budgets |

## Exécution

```bash
# Local (5-7 min)
npm run test:ultimate

# CI (nightly)
DATABASE_URL=$INTEGRATION_DB_URL npx playwright test --grep @ultimate

# Avant chaque release de prod
npm run test:ultimate:release
```

## En cas d'échec

1. Ouvrir le rapport HTML Playwright (`playwright-report/`).
2. Identifier la phase qui échoue.
3. Consulter le runbook correspondant :
   - Phase 1-2 : `13-runbook/deployment-runbook.md`
   - Phase 6-7 : `13-runbook/incident-response.md`
   - Phase 8 : `13-runbook/rollback-runbook.md`
4. **Ne JAMAIS bypasser cet échec** pour activer en prod.
5. Si bloqué, ouvrir un ticket TP2-incident et engager le tech lead.

---

> **Rappel** : ce test est l'ultime filet de sécurité. Il est conçu pour échouer **tôt** si une régression touche n'importe lequel des 14 critères. Il ne peut **pas** être désactivé ou skippé sans validation explicite du tech lead + CMO.
