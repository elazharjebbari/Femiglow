# Tests redirections legacy

## Anciennes routes → nouveau wizard

```typescript
test.describe('Legacy redirects', () => {
  test('/admin/tracking-tags redirects to /admin/tracking', async ({ page }) => {
    await page.goto('/admin/tracking-tags')
    await page.waitForURL('/admin/tracking')
  })

  test('/admin/pixel-config redirects to /admin/tracking', async ({ page }) => {
    await page.goto('/admin/pixel-config')
    await page.waitForURL('/admin/tracking')
  })

  test('/admin/gtm-export redirects to /admin/tracking/plan/:id?mode=expert', async ({ page }) => {
    await page.goto('/admin/gtm-export')
    await page.waitForURL(/\/admin\/tracking\/plan\/.+\?mode=expert/)
  })

  test('old route shows migration banner', async ({ page }) => {
    await page.goto('/admin/tracking-tags')
    await page.waitForURL('/admin/tracking')
    
    await expect(page.getByText(/Cette page a déménagé/)).toBeVisible()
    await expect(page.getByRole('link', { name: /Guide de migration/ })).toBeVisible()
  })
})
```

## Bookmarks externes

```typescript
test('external link with /tracking-tags works via 301', async ({ page, request }) => {
  const response = await request.get('/admin/tracking-tags', { maxRedirects: 0 })
  expect(response.status()).toBe(301)
  expect(response.headers().location).toBe('/admin/tracking')
})
```

## API legacy → nouveau endpoint

```typescript
test.describe('Legacy API redirects', () => {
  test('GET /api/admin/tags returns deprecated header', async ({ request }) => {
    const response = await request.get('/api/admin/tags')
    expect(response.status()).toBe(200)
    expect(response.headers()).toMatchObject({
      'x-deprecation': expect.stringContaining('removed-after: 2026-08-14'),
      'x-replacement': '/api/admin/tracking/plans',
    })
  })

  test('GET /api/admin/pixel-config also deprecated', async ({ request }) => {
    const response = await request.get('/api/admin/pixel-config')
    expect(response.headers()['x-deprecation']).toBeDefined()
  })
})
```

## Données legacy lues correctement

```typescript
test('plan créé avant migration est lisible', async ({ page }) => {
  // Seed : un plan en table _legacy_v1
  await page.goto('/admin/tracking')
  await expect(page.getByRole('row', { name: /Migré depuis v1/ })).toBeVisible()
  
  await page.getByRole('row', { name: /Migré depuis v1/ })
    .getByRole('button', { name: /Voir/ }).click()
  
  // Affiche les bonnes données mappées
  await expect(page.getByText(/Provider GA4/)).toBeVisible()
})
```
