# Tests Wizard 5 étapes

## Navigation

```typescript
test.describe('Wizard navigation', () => {
  test('continuer enabled only when current step valid', async ({ page }) => {
    await page.goto('/admin/tracking/new')
    
    const continueBtn = page.getByRole('button', { name: /Continuer/ })
    await expect(continueBtn).toBeDisabled()  // pas de provider choisi
    
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await expect(continueBtn).toBeEnabled()
  })

  test('clicking previous step navigates back', async ({ page }) => {
    const wizard = new WizardPage(page)
    await wizard.goto()
    
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await wizard.clickContinuer()
    await wizard.expectStep(2)
    
    await page.getByRole('button', { name: /Étape 1/ }).click()
    await wizard.expectStep(1)
    
    // GA4 toujours coché
    await expect(page.getByRole('checkbox', { name: 'GA4' })).toBeChecked()
  })

  test('future step click shows shake + tooltip', async ({ page }) => {
    await page.goto('/admin/tracking/new')
    
    const futureStep = page.getByRole('button', { name: /Étape 4/ })
    await futureStep.click()
    
    await expect(futureStep).toHaveClass(/shake/)
    await expect(page.getByText(/Terminez d'abord/)).toBeVisible()
  })
})
```

## Auto-save

```typescript
test.describe('Wizard autosave', () => {
  test('saves after 5s of inactivity', async ({ page }) => {
    const wizard = new WizardPage(page)
    await wizard.goto()
    
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await wizard.clickContinuer()
    await wizard.fillGa4MeasurementId('G-AUTOSAVE1')
    
    // Indicateur "non sauvegardé"
    await expect(page.getByText(/non sauvegardées/)).toBeVisible()
    
    // Après 5s sans action
    await page.waitForTimeout(5_500)
    await expect(page.getByText(/Sauvegardé il y a/)).toBeVisible()
  })

  test('manual save via Cmd+S', async ({ page }) => {
    const wizard = new WizardPage(page)
    await wizard.goto()
    
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await wizard.clickContinuer()
    await wizard.fillGa4MeasurementId('G-MANUAL01')
    
    await page.keyboard.press('Meta+S')
    await expect(page.getByText(/Sauvegardé/)).toBeVisible({ timeout: 2_000 })
  })

  test('autosave debounce: 3 rapid changes = 1 request', async ({ page, request }) => {
    let saveCount = 0
    await page.route('**/api/tracking/draft', route => {
      saveCount++
      route.continue()
    })
    
    const wizard = new WizardPage(page)
    await wizard.goto()
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await wizard.clickContinuer()
    
    await wizard.fillGa4MeasurementId('A')
    await wizard.fillGa4MeasurementId('AB')
    await wizard.fillGa4MeasurementId('ABC')
    
    await page.waitForTimeout(6_000)
    expect(saveCount).toBe(1)
  })
})
```

## Validation step-by-step

```typescript
test.describe('Wizard step validation', () => {
  test('step 2 blocks continuer on R-001 placeholder', async ({ page }) => {
    const wizard = new WizardPage(page)
    await wizard.goto()
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    await wizard.clickContinuer()
    
    await wizard.fillGa4MeasurementId('G-PROD0000')
    await expect(page.getByText(/Ressemble à une valeur de démo/)).toBeVisible()
    
    await wizard.clickContinuer()
    // Bloqué, toujours sur step 2
    await wizard.expectStep(2)
    await expect(page.getByText(/Veuillez corriger les erreurs/)).toBeVisible()
  })

  test('step 3 warns if 0 events', async ({ page }) => {
    const wizard = new WizardPage(page)
    await wizard.goto()
    // ... walk to step 3 ...
    await wizard.expectStep(3)
    
    await wizard.clickContinuer()
    await expect(page.getByText(/Aucun événement défini/)).toBeVisible()
    
    // Pas bloquant mais demande confirmation
    await page.getByRole('button', { name: /Continuer quand même/ }).click()
    await wizard.expectStep(4)
  })
})
```

## Récap (step 5)

```typescript
test.describe('Wizard récap', () => {
  test('shows all sections with edit links', async ({ page }) => {
    // ... walk to step 5 with valid plan
    
    await expect(page.getByRole('heading', { name: /Récap/ })).toBeVisible()
    await expect(page.getByText(/3 outils actifs/)).toBeVisible()
    await expect(page.getByText(/G-5VHP17SDZM/)).toBeVisible()
    
    // Click edit on a section
    await page.getByRole('button', { name: /Modifier les IDs/ }).click()
    await page.waitForURL(/wizard\?step=2/)
  })

  test('activate disabled if errors present', async ({ page }) => {
    // ... step 5 with R-001 errors
    const activateBtn = page.getByRole('button', { name: /Activer en production/ })
    await expect(activateBtn).toBeDisabled()
    
    await expect(page.getByText(/Corrigez les erreurs/)).toBeVisible()
  })
})
```
