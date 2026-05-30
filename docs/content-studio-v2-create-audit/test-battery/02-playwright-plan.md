# Playwright Plan — Content Studio v2 Create

## Pré-requis serveur

Le serveur doit tourner en mock mode :

```bash
CONTENT_STUDIO_V2_MOCK_MODE=true \
CONTENT_STUDIO_IMAGE_PROVIDER=mock \
CONTENT_STUDIO_VIDEO_PROVIDER=mock \
pm2 restart web
```

Une fixture admin doit exister pour le login automatique. Voir `e2e/helpers/auth.ts`.

## Specs

| # | Fichier | Scénario | Tests estimés |
|---|---------|----------|---------------|
| 1 | `create-golden-path.spec.ts` | S01 — Parcours nominal mock | 6 |
| 2 | `create-model-switching.spec.ts` | S02 — Switch modèle texte + image + video | 8 |
| 3 | `create-mock-video.spec.ts` | S03 — Génération vidéo mock | 4 |
| 4 | `create-step-progression.spec.ts` | S04 — Progression du stepper | 5 |
| 5 | `create-budget-exhaustion.spec.ts` | S05 — Budget épuisé | 4 |
| 6 | `create-error-recovery.spec.ts` | S06 — Erreurs réseau / serveur | 6 |
| 7 | `create-scheduling.spec.ts` | S07 — Planification + reschedule | 5 |
| 8 | `create-concurrent-edits.spec.ts` | S08 — Édition concurrente / conflit | 4 |
| 9 | `create-a11y.spec.ts` | Cross-cutting a11y | 6 |
| 10 | `create-dark-mode.spec.ts` | Cross-cutting dark mode | 3 |
| 11 | `create-responsive.spec.ts` | Cross-cutting responsive | 4 |
| 12 | `create-keyboard.spec.ts` | Cross-cutting keyboard | 4 |
| **Total** | | | **~59 tests** |

## Conventions

### Structure spec

```ts
// e2e/content-studio-v2/create-golden-path.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

test.describe('Content Studio v2 — Create golden path', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/content-studio-v2/create');
  });

  test('completes full create → publish in mock mode', async ({ page }) => {
    // Step 1: Fill intention
    await page.getByRole('radio', { name: /reel/i }).click();
    await page.locator('select').nth(0).selectOption('rituel');
    await page.getByLabel(/intention/i).fill('Présenter le rituel du soir');
    await page.getByRole('button', { name: /enregistrer/i }).click();

    // Step 2: Wait variants
    await expect(page.getByText(/3 variantes/i)).toBeVisible({ timeout: 30000 });

    // Choose variant A
    await page.getByRole('button', { name: /choisir cette variante/i }).first().click();
    await expect(page.locator('[data-step="visual"][data-state="active"]')).toBeVisible();

    // Step 3: Generate video (mock)
    await page.getByRole('tab', { name: /générer ia/i }).click();
    await page.getByRole('button', { name: /générer/i }).click();
    await expect(page.locator('video')).toBeVisible({ timeout: 15000 });

    // Step 4: Approve
    await page.getByRole('button', { name: /valider et préparer/i }).click();
    await expect(page.getByText(/draft validé/i)).toBeVisible();
    await expect(page.locator('[data-step="validate"][data-state="active"]')).toBeVisible();

    // Publish
    await page.getByRole('button', { name: /publier/i }).click();
    await page.getByRole('menuitem', { name: /publier maintenant/i }).click();
    await page.getByRole('button', { name: /confirmer/i }).click();
    await expect(page.getByText(/publication lancée/i)).toBeVisible();
  });
});
```

## Helpers

### auth.ts
```ts
export async function loginAsAdmin(page: Page) {
  // Use existing test admin cookie via API or login page
  await page.context().addCookies([{
    name: 'auth-token',
    value: process.env.E2E_ADMIN_TOKEN!,
    domain: 'localhost',
    path: '/',
  }]);
}
```

### selectors
Préférer les selectors par rôle ARIA. Eviter `data-testid` quand possible.

### waitForGeneration
```ts
export async function waitForVariants(page: Page) {
  await expect(page.getByText(/3 variantes/i)).toBeVisible({ timeout: 30000 });
}
```

## Configuration playwright.config.ts

```ts
export default defineConfig({
  testDir: './e2e',
  workers: 2,
  reporter: [['html'], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8012',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } }, // optionnel
  ],
});
```

## Snapshots

- Stockage : `e2e/__snapshots__/content-studio-v2/`
- Update : `npx playwright test --update-snapshots`
- Cap (threshold) : 0.1% pixels différents (compenser anti-aliasing)

## Commandes

```bash
# Tous E2E
npx playwright test

# Spec spécifique
npx playwright test e2e/content-studio-v2/create-golden-path.spec.ts

# Mode UI (debug)
npx playwright test --ui

# Rapport HTML
npx playwright show-report
```
