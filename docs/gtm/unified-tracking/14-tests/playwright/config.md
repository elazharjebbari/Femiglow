# Config Playwright

## playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'fr-MA',
    timezoneId: 'Africa/Casablanca',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      dependencies: ['setup'],
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
      testMatch: /journeys|a11y/,
    },
    {
      name: 'arabic-rtl',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-MA',
      },
      testMatch: /i18n/,
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

## Global setup — e2e/global.setup.ts

```typescript
import { test as setup, expect } from '@playwright/test'
import { resetTestDb, seedTestDb } from './helpers/db'

setup('reset DB and seed', async () => {
  await resetTestDb()
  await seedTestDb({
    plans: [
      { name: 'Plan actif Production v8', status: 'active' },
      { name: 'Brouillon en cours', status: 'draft' },
      { name: 'Archive v6', status: 'archived' },
    ],
  })
})

setup('authenticate admin', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name=email]', 'amal@femiglow.ma')
  await page.fill('[name=password]', process.env.E2E_ADMIN_PW!)
  await page.click('button[type=submit]')
  await page.waitForURL('/admin')
  await page.context().storageState({ path: 'e2e/auth/admin.json' })
})
```

## Variables d'environnement

```bash
# .env.e2e (gitignored)
E2E_BASE_URL=http://localhost:3000
E2E_DATABASE_URL=postgres://test:test@localhost:5433/femiglow_e2e
E2E_ADMIN_PW=test-admin-pw
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

## Commandes utiles

```bash
# Tous les tests
npx playwright test

# Un fichier
npx playwright test journeys.spec.ts

# Un projet (browser)
npx playwright test --project=chromium-desktop

# Avec UI mode
npx playwright test --ui

# En mode debug
npx playwright test --debug

# Headed (voir le browser)
npx playwright test --headed

# Tag spécifique
npx playwright test --grep @critical

# Snapshot update
npx playwright test --update-snapshots

# Reporter HTML
npx playwright show-report
```

## Configuration CI (.github/workflows/e2e.yml)

```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps

- name: Run Playwright tests
  run: npx playwright test
  env:
    E2E_DATABASE_URL: ${{ secrets.E2E_DB_URL }}
    E2E_ADMIN_PW: ${{ secrets.E2E_ADMIN_PW }}

- name: Upload report
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
```

## Page Objects (exemple)

```typescript
// e2e/pages/WizardPage.ts
import { Page, expect } from '@playwright/test'

export class WizardPage {
  constructor(private page: Page) {}

  async goto(planId?: string) {
    const url = planId ? `/admin/tracking/${planId}/wizard` : '/admin/tracking/new'
    await this.page.goto(url)
  }

  async fillGa4MeasurementId(value: string) {
    await this.page.getByLabel('GA4 Measurement ID').fill(value)
  }

  async clickContinuer() {
    await this.page.getByRole('button', { name: /Continuer/i }).click()
  }

  async expectStep(n: number) {
    await expect(this.page.getByRole('button', { name: new RegExp(`Étape ${n}`) }))
      .toHaveAttribute('aria-current', 'step')
  }

  async expectAutosaveBadge() {
    await expect(this.page.getByText(/Sauvegardé il y a/)).toBeVisible({ timeout: 7_000 })
  }
}
```
