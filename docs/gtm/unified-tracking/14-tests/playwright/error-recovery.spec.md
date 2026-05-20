# Tests récupération d'erreurs

## Perte de connexion

```typescript
test.describe('Network errors', () => {
  test('autosave queues writes when offline', async ({ page, context }) => {
    await page.goto('/admin/tracking/new')
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    
    // Couper le réseau
    await context.setOffline(true)
    
    await page.getByRole('button', { name: /Continuer/ }).click()
    await page.getByLabel('GA4 Measurement ID').fill('G-OFFLINE01')
    
    // Indicateur offline
    await expect(page.getByText(/Hors ligne/)).toBeVisible({ timeout: 6_000 })
    await expect(page.getByText(/Modifications en attente/)).toBeVisible()
    
    // Reconnect
    await context.setOffline(false)
    
    // Sync auto
    await expect(page.getByText(/Synchronisé/)).toBeVisible({ timeout: 10_000 })
  })

  test('shows retry button when save fails', async ({ page, request }) => {
    await page.route('**/api/tracking/draft', route => route.abort('failed'))
    
    await page.goto('/admin/tracking/new')
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await page.keyboard.press('Meta+S')
    
    await expect(page.getByRole('alert')).toContainText(/Erreur de sauvegarde/)
    await expect(page.getByRole('button', { name: /Réessayer/ })).toBeVisible()
  })

  test('retry works after fixing network', async ({ page }) => {
    let firstAttempt = true
    await page.route('**/api/tracking/draft', route => {
      if (firstAttempt) {
        firstAttempt = false
        return route.abort('failed')
      }
      return route.continue()
    })
    
    await page.goto('/admin/tracking/new')
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await page.keyboard.press('Meta+S')
    
    await expect(page.getByRole('alert')).toContainText(/Erreur/)
    await page.getByRole('button', { name: /Réessayer/ }).click()
    
    await expect(page.getByText(/Sauvegardé/)).toBeVisible()
  })
})
```

## Conflits d'édition (optimistic concurrency)

```typescript
test.describe('Edit conflicts', () => {
  test('shows conflict resolution dialog on stale version', async ({ page, browser }) => {
    // User A ouvre le draft
    await page.goto('/admin/tracking/plan/draft-001')
    
    // User B modifie depuis un autre contexte
    const contextB = await browser.newContext({ storageState: 'e2e/auth/younes.json' })
    const pageB = await contextB.newPage()
    await pageB.goto('/admin/tracking/plan/draft-001')
    await pageB.getByLabel('Nom du plan').fill('Renamed by Younes')
    await pageB.keyboard.press('Meta+S')
    await pageB.close()
    
    // User A tente de sauvegarder
    await page.getByLabel('Nom du plan').fill('Renamed by Amal')
    await page.keyboard.press('Meta+S')
    
    // Dialog conflit
    await expect(page.getByRole('dialog', { name: /Conflit de version/ })).toBeVisible()
    await expect(page.getByText(/Younes.*il y a/)).toBeVisible()
    
    // Options
    await expect(page.getByRole('button', { name: /Garder mes modifications/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Garder la version récente/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Fusionner/ })).toBeVisible()
  })
})
```

## Récupération brouillon

```typescript
test.describe('Draft recovery', () => {
  test('recovers from localStorage after browser crash', async ({ page }) => {
    await page.goto('/admin/tracking/new')
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await page.getByRole('button', { name: /Continuer/ }).click()
    await page.getByLabel('GA4 Measurement ID').fill('G-CRASH01234')
    
    // Wait localStorage write
    await page.waitForTimeout(1_000)
    
    // Simuler crash : close + reopen
    const localStorageBackup = await page.evaluate(() => JSON.stringify(localStorage))
    
    await page.goto('about:blank')
    await page.goto('/admin/tracking/new')
    await page.evaluate(data => {
      const parsed = JSON.parse(data)
      Object.entries(parsed).forEach(([k, v]) => localStorage.setItem(k, v as string))
    }, localStorageBackup)
    await page.reload()
    
    // Bannière recovery
    await expect(page.getByText(/Brouillon non sauvegardé détecté/)).toBeVisible()
    await page.getByRole('button', { name: /Récupérer/ }).click()
    
    await expect(page.getByLabel('GA4 Measurement ID')).toHaveValue('G-CRASH01234')
  })

  test('discard draft removes it from localStorage', async ({ page }) => {
    // ... setup with draft
    await page.goto('/admin/tracking/new')
    await expect(page.getByText(/Brouillon non sauvegardé/)).toBeVisible()
    
    await page.getByRole('button', { name: /Ignorer/ }).click()
    
    const stored = await page.evaluate(() => localStorage.getItem('femiglow.tracking-plan-draft.v1'))
    expect(stored).toBeNull()
  })
})
```

## Erreur serveur 500

```typescript
test('500 error shows graceful error page with retry', async ({ page }) => {
  await page.route('**/api/tracking/plans', route => {
    route.fulfill({ status: 500, body: JSON.stringify({ error: 'internal' }) })
  })
  
  await page.goto('/admin/tracking')
  
  await expect(page.getByRole('alert')).toContainText(/Erreur serveur/)
  await expect(page.getByRole('button', { name: /Réessayer/ })).toBeVisible()
  
  // Link to support
  await expect(page.getByRole('link', { name: /Support/ })).toBeVisible()
})
```

## Session expirée

```typescript
test('expired session redirects to login with return URL', async ({ page }) => {
  await page.route('**/api/tracking/**', route => {
    route.fulfill({ status: 401, body: JSON.stringify({ error: 'expired' }) })
  })
  
  await page.goto('/admin/tracking')
  
  await page.waitForURL(/\/login\?returnTo=/)
  expect(page.url()).toContain(encodeURIComponent('/admin/tracking'))
})
```
