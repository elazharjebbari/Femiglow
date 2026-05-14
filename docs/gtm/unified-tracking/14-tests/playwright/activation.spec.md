# Tests activation / rollback

## Activation transactionnelle

```typescript
import { test, expect } from '@playwright/test'

test.describe('Plan activation @critical', () => {
  test('activate un draft archive l\'ancien plan actif', async ({ page, request }) => {
    // Seed : 1 plan actif + 1 draft prêt
    await page.goto('/admin/tracking')
    
    await page.getByRole('row', { name: /Brouillon prêt/ })
      .getByRole('button', { name: /Activer/ }).click()

    // Modale de confirmation
    await expect(page.getByRole('dialog')).toContainText(/L'ancien plan sera archivé/)
    await page.getByRole('button', { name: /Confirmer activation/ }).click()

    // Le nouveau est actif
    await expect(page.getByRole('row', { name: /Brouillon prêt/ }))
      .toContainText(/Actif/)
    
    // L'ancien est archivé
    await expect(page.getByRole('row', { name: /Plan actif Production v8/ }))
      .toContainText(/Archivé/)
  })

  test('activation échoue si validation refuse (R-001)', async ({ page }) => {
    await page.goto('/admin/tracking/plan/draft-with-placeholder')
    await page.getByRole('button', { name: /Activer/ }).click()
    
    await expect(page.getByRole('alert')).toContainText(/Validation refusée/)
    await expect(page.getByText(/G-PROD0000.*placeholder/)).toBeVisible()
    
    // Pas de bascule
    await page.goto('/admin/tracking')
    await expect(page.getByRole('row', { name: /Plan actif Production v8/ }))
      .toContainText(/Actif/)
  })

  test('activation atomique : si audit échoue, plan reste draft', async ({ page, request }) => {
    // Simuler audit DB indisponible
    await request.post('/api/test/disable-audit-table')
    
    await page.goto('/admin/tracking/plan/draft-001')
    await page.getByRole('button', { name: /Activer/ }).click()
    await page.getByRole('button', { name: /Confirmer/ }).click()
    
    await expect(page.getByRole('alert')).toContainText(/Erreur transactionnelle/)
    
    // Re-enable audit and check state
    await request.post('/api/test/enable-audit-table')
    await page.goto('/admin/tracking')
    await expect(page.getByRole('row', { name: /draft-001/ })).toContainText(/Brouillon/)
  })
})
```

## Rollback

```typescript
test.describe('Rollback', () => {
  test('rollback to previous active plan in 1 click', async ({ page }) => {
    await page.goto('/admin/tracking/history')

    // Cliquer sur l'avant-dernier plan actif (le précédent)
    await page.getByRole('row', { name: /Production v7.*Archivé/ })
      .getByRole('button', { name: /Restaurer/ }).click()
    
    await expect(page.getByRole('dialog')).toContainText(/Restaurer v7 comme plan actif/)
    await page.getByRole('button', { name: /Confirmer rollback/ }).click()

    // V7 redevient actif, V8 archivé
    await expect(page.getByRole('row', { name: /Production v7/ })).toContainText(/Actif/)
    await expect(page.getByRole('row', { name: /Production v8/ })).toContainText(/Archivé/)
    
    // Audit entry
    await page.goto('/admin/tracking/audit')
    await expect(page.getByText(/rollback to v7/)).toBeVisible()
  })

  test('rollback requires confirmation typing', async ({ page }) => {
    await page.goto('/admin/tracking/history')
    await page.getByRole('row', { name: /Production v6/ })
      .getByRole('button', { name: /Restaurer/ }).click()

    const confirmBtn = page.getByRole('button', { name: /Confirmer rollback/ })
    await expect(confirmBtn).toBeDisabled()
    
    await page.getByLabel('Tapez "RESTORE" pour confirmer').fill('RESTORE')
    await expect(confirmBtn).toBeEnabled()
  })
})
```

## Healthcheck post-activation

```typescript
test('healthcheck affiche OK 30s après activation', async ({ page }) => {
  await page.goto('/admin/tracking')
  await page.getByRole('row', { name: /Brouillon prêt/ })
    .getByRole('button', { name: /Activer/ }).click()
  await page.getByRole('button', { name: /Confirmer/ }).click()
  
  await page.goto('/admin/tracking/health')
  
  // Loading state
  await expect(page.getByText(/Vérification en cours/)).toBeVisible()
  
  // Result within 30s
  await expect(page.getByRole('status', { name: /Santé/ }))
    .toContainText(/Tout est OK/, { timeout: 30_000 })
})
```
