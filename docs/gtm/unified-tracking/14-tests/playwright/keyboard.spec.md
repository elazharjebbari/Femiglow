# Tests raccourcis clavier et focus management

## Raccourcis globaux

```typescript
test.describe('Raccourcis clavier globaux', () => {
  test('Cmd+K opens command palette', async ({ page }) => {
    await page.goto('/admin/tracking')
    await page.keyboard.press('Meta+K')
    
    await expect(page.getByRole('dialog', { name: /Recherche/ })).toBeVisible()
    await expect(page.getByPlaceholder(/Rechercher/)).toBeFocused()
  })

  test('Cmd+S triggers manual save in wizard', async ({ page }) => {
    await page.goto('/admin/tracking/new')
    await page.getByRole('checkbox', { name: 'GA4' }).check()
    
    await page.keyboard.press('Meta+S')
    
    await expect(page.getByText(/Sauvegardé/)).toBeVisible({ timeout: 2_000 })
  })

  test('Escape closes modale', async ({ page }) => {
    await page.goto('/admin/tracking/plan/draft-001?step=5')
    await page.getByRole('button', { name: /Activer/ }).click()
    
    await expect(page.getByRole('dialog')).toBeVisible()
    
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('? opens shortcuts help', async ({ page }) => {
    await page.goto('/admin/tracking')
    await page.keyboard.press('Shift+?')
    
    await expect(page.getByRole('dialog', { name: /Raccourcis/ })).toBeVisible()
  })
})
```

## Navigation Tab

```typescript
test.describe('Tab navigation', () => {
  test('tab order respects visual order in wizard', async ({ page }) => {
    await page.goto('/admin/tracking/new?step=2')
    
    const expectedOrder = [
      'GA4 Measurement ID',
      'Google Ads Conversion ID',
      'Meta Pixel ID',
      'Continuer',
    ]
    
    for (const expected of expectedOrder) {
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        return el?.getAttribute('aria-label') || el?.textContent?.trim()
      })
      expect(focused).toContain(expected)
    }
  })

  test('Shift+Tab navigates backward', async ({ page }) => {
    await page.goto('/admin/tracking/new?step=1')
    
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    
    // Should be at 2nd focusable
    const focusedIdx = await page.evaluate(() => {
      const focusable = document.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')
      return Array.from(focusable).indexOf(document.activeElement as Element)
    })
    expect(focusedIdx).toBe(1)
  })
})
```

## Focus management

```typescript
test.describe('Focus management', () => {
  test('after submit, focus moves to next logical element', async ({ page }) => {
    await page.goto('/admin/tracking/new?step=2')
    
    await page.getByLabel('GA4 Measurement ID').fill('G-5VHP17SDZM')
    await page.getByRole('button', { name: /Continuer/ }).click()
    
    // Focus on step 3 first interactive element
    const focused = page.locator(':focus')
    await expect(focused).toHaveText(/page_view|Sélectionner|Événement/i)
  })

  test('modal opens and traps focus inside', async ({ page }) => {
    await page.goto('/admin/tracking/plan/draft-001?step=5')
    await page.getByRole('button', { name: /Activer/ }).click()
    
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    
    // Focus first focusable inside dialog
    const focusedInside = await page.evaluate(() => {
      return document.activeElement?.closest('[role=dialog]') !== null
    })
    expect(focusedInside).toBe(true)
    
    // Tab cycles inside
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    
    const stillInside = await page.evaluate(() => {
      return document.activeElement?.closest('[role=dialog]') !== null
    })
    expect(stillInside).toBe(true)
  })

  test('modal close restores focus to opener', async ({ page }) => {
    await page.goto('/admin/tracking/plan/draft-001?step=5')
    
    const opener = page.getByRole('button', { name: /Activer/ })
    await opener.click()
    
    await page.keyboard.press('Escape')
    
    await expect(opener).toBeFocused()
  })
})
```

## Stepper navigation au clavier

```typescript
test('stepper buttons are reachable via Tab', async ({ page }) => {
  await page.goto('/admin/tracking/new?step=3')
  
  await page.keyboard.press('Tab')  // skip link
  // .. tab jusqu'au stepper
  
  const step1 = page.getByRole('button', { name: /Étape 1/ })
  await step1.focus()
  await page.keyboard.press('Enter')
  
  await expect(page).toHaveURL(/step=1/)
})
```
