# Tests détection de drift

## Pings client → server

```typescript
describe('Client → Server drift', () => {
  it('client envoie son bundleId via beacon', async ({ page, request }) => {
    // Capture le beacon
    const beacons: any[] = []
    await page.route('**/api/tracking/health/ping', route => {
      route.request().postData()?.let(d => beacons.push(JSON.parse(d)))
      route.fulfill({ status: 200, body: '{}' })
    })
    
    await page.goto('/')  // home avec tracking
    await page.waitForTimeout(2_000)
    
    expect(beacons.length).toBeGreaterThan(0)
    expect(beacons[0]).toMatchObject({
      clientBundleId: expect.stringMatching(/^[a-f0-9]{64}$/),
      env: expect.any(String),
      timestamp: expect.any(String),
    })
  })
})
```

## Niveaux de drift

```typescript
describe('Drift levels', () => {
  it('drift = none quand bundleId identique', async () => {
    const planId = await activeNewPlan()
    const bundle = await getExportBundle(planId)
    
    await ping({ clientBundleId: bundle })
    const health = await getHealth()
    
    expect(health.drift).toBe('none')
  })
  
  it('drift = warning quand client behind <5min', async () => {
    const planId = await activeNewPlan()
    const oldBundle = await getExportBundle(planId)
    
    // Update minor
    await updatePlanLabel(planId, 'Renamed')
    
    await ping({ clientBundleId: oldBundle })
    const health = await getHealth()
    
    expect(health.drift).toBe('warning')
  })
  
  it('drift = critical quand bundle obsolète > 5min', async () => {
    const planId = await activeNewPlan()
    const oldBundle = await getExportBundle(planId)
    
    // Activate new plan
    await activeNewPlan()
    
    // Simulate 6 min ago
    await ping({
      clientBundleId: oldBundle,
      timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    })
    
    const health = await getHealth()
    expect(health.drift).toBe('critical')
  })
})
```

## Alertes

```typescript
describe('Drift alerts', () => {
  it('drift critique déclenche alerte Slack (simulée)', async () => {
    const slackMessages: any[] = []
    await mockSlackWebhook(slackMessages)
    
    await simulateDriftCritical()
    
    await waitFor(() => expect(slackMessages.length).toBeGreaterThan(0))
    expect(slackMessages[0].text).toContain('Drift critique')
  })
  
  it('warning ne déclenche pas d\'alerte (juste log)', async () => {
    const slackMessages: any[] = []
    await mockSlackWebhook(slackMessages)
    
    await simulateDriftWarning()
    
    await new Promise(r => setTimeout(r, 1000))
    expect(slackMessages.length).toBe(0)
  })
})
```

## Auto-recovery

```typescript
describe('Drift auto-recovery', () => {
  it('client refetch après drift detected', async ({ page }) => {
    // Simulate drift
    await page.goto('/')
    
    // Inject old bundle
    await page.evaluate(() => {
      window.localStorage.setItem('femiglow.tracking.bundle', 'old-bundle-123')
    })
    
    await page.reload()
    
    // Le client doit appeler /export et recharger
    let exportCalls = 0
    page.on('request', req => {
      if (req.url().includes('/export')) exportCalls++
    })
    
    await page.waitForTimeout(5_000)
    expect(exportCalls).toBeGreaterThan(0)
  })
})
```

## Tableau de bord drift

```typescript
describe('Drift dashboard', () => {
  it('admin voit le statut drift global', async ({ page }) => {
    await page.goto('/admin/tracking/health')
    
    await expect(page.getByRole('heading', { name: /Santé du tracking/ })).toBeVisible()
    await expect(page.getByText(/Statut\u00a0:/)).toBeVisible()
    await expect(page.getByText(/Plan actif\u00a0:/)).toBeVisible()
    await expect(page.getByText(/Bundle\u00a0:/)).toBeVisible()
    await expect(page.getByText(/Drift\u00a0:/)).toBeVisible()
    
    // Graphique drift dans le temps (24h)
    await expect(page.locator('[data-testid="drift-timeline"]')).toBeVisible()
  })
})
```
