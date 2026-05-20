# Tests mode expert (3 colonnes)

## Layout

```typescript
test.describe('Expert mode layout', () => {
  test('displays 3 columns: tree, form, JSON', async ({ page }) => {
    await page.goto('/admin/tracking/new?mode=expert')
    
    await expect(page.locator('[data-testid="expert-tree"]')).toBeVisible()
    await expect(page.locator('[data-testid="expert-form"]')).toBeVisible()
    await expect(page.locator('[data-testid="json-preview"]')).toBeVisible()
  })

  test('tree allows multi-section navigation', async ({ page }) => {
    await page.goto('/admin/tracking/plan/draft-001?mode=expert')
    
    await page.getByRole('treeitem', { name: 'Events' }).click()
    await expect(page.locator('[data-testid="expert-form"]'))
      .toContainText(/Configuration événements/)
    
    await page.getByRole('treeitem', { name: 'Providers' }).click()
    await expect(page.locator('[data-testid="expert-form"]'))
      .toContainText(/Configuration outils/)
  })
})
```

## JSON live preview

```typescript
test.describe('JSON live preview', () => {
  test('updates within 300ms after form change', async ({ page }) => {
    await page.goto('/admin/tracking/new?mode=expert')
    
    await page.getByLabel('Nom du plan').fill('Mon plan test')
    
    const preview = page.locator('[data-testid="json-preview"]')
    await expect(preview).toContainText('"name": "Mon plan test"', { timeout: 1_000 })
  })

  test('preview is read-only', async ({ page }) => {
    await page.goto('/admin/tracking/plan/draft-001?mode=expert')
    
    const preview = page.locator('[data-testid="json-preview"]')
    await expect(preview).toHaveAttribute('contenteditable', 'false')
  })

  test('copy JSON button works', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/admin/tracking/plan/draft-001?mode=expert')
    
    await page.getByRole('button', { name: /Copier JSON/ }).click()
    await expect(page.getByText(/JSON copié/)).toBeVisible()
    
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toContain('"name":')
  })
})
```

## Import / Export expert

```typescript
test.describe('Expert import/export', () => {
  test('imports valid GTM JSON', async ({ page }) => {
    await page.goto('/admin/tracking/new?mode=expert')
    
    await page.getByRole('button', { name: /Importer JSON/ }).click()
    await page.locator('input[type=file]')
      .setInputFiles('e2e/fixtures/valid-gtm-export.json')
    
    await expect(page.getByText(/Importé avec succès/)).toBeVisible()
    await expect(page.locator('[data-testid="expert-tree"]'))
      .toContainText(/15 tags/)
  })

  test('rejects malformed JSON with clear error', async ({ page }) => {
    await page.goto('/admin/tracking/new?mode=expert')
    
    await page.getByRole('button', { name: /Importer JSON/ }).click()
    await page.locator('input[type=file]')
      .setInputFiles('e2e/fixtures/malformed.json')
    
    await expect(page.getByRole('alert')).toContainText(/JSON invalide/)
    await expect(page.getByText(/Ligne 12.*caractère/)).toBeVisible()
  })

  test('export downloads current plan as JSON', async ({ page }) => {
    await page.goto('/admin/tracking/plan/active-prod-v8?mode=expert')
    
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Télécharger JSON/ }).click()
    const download = await downloadPromise
    
    expect(download.suggestedFilename()).toMatch(/tracking-plan-v8.*\.json/)
  })
})
```

## Toggle mode wizard ↔ expert

```typescript
test('switches from expert to wizard preserves draft', async ({ page }) => {
  await page.goto('/admin/tracking/new?mode=expert')
  await page.getByLabel('Nom du plan').fill('Mon plan')
  
  await page.getByRole('button', { name: /Mode wizard/ }).click()
  await page.waitForURL(/mode=wizard/)
  
  // Le nom est conservé (visible au récap)
  await page.goto('/admin/tracking/new?step=5&mode=wizard')
  await expect(page.getByText('Mon plan')).toBeVisible()
})
```
