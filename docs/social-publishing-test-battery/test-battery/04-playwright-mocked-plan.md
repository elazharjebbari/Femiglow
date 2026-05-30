# Playwright Mocked plan

## Specs × scénarios

| Spec | Scénario | Tests | @tag |
|------|----------|-------|------|
| `publish-now-golden-path.spec.ts` | S01 | 3 | |
| `schedule-golden-path.spec.ts` | S02 | 4 | |
| `postiz-draft-golden-path.spec.ts` | S03 | 2 | |
| `account-disconnect.spec.ts` | S04 | 2 | |
| `multi-platform-bulk.spec.ts` | S05 | 2 | |
| `failed-then-retried.spec.ts` | S06 | 2 | |
| `scheduled-cancelled.spec.ts` | S07 | 3 | |
| `network-blackout.spec.ts` | S08 | 2 | |
| `postiz-rate-limit.spec.ts` | S10 | 2 | |
| `idempotency-race.spec.ts` | S11 | 2 | |
| `calendar-week-view.spec.ts` | S12 | 5 | |
| `week-bulk-schedule.spec.ts` | S15 | 2 | |
| `token-expiry.spec.ts` | S17 | 2 | |
| `brand-violation.spec.ts` | S19 | 2 | |
| `a11y.spec.ts` | cross-cutting | 6 | |
| `dark-mode.spec.ts` | cross-cutting | 4 | |
| `responsive.spec.ts` | cross-cutting | 4 | |
| `keyboard.spec.ts` | cross-cutting | 4 | |
| `live-instagram-alfenna.spec.ts` | S13 | 2 | @live |
| **Total** | | **~53 tests** | |

## Pattern spec

```ts
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerPublishMocks, driveToPublishStep } from './helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Social Publishing — publish-now golden path', () => {
  test('S01: opérateur publie sur IG immédiatement', async ({ page }) => {
    const state = await registerPublishMocks(page, { initialJobs: [], initialAccounts: [...] });
    await driveToPublishStep(page, { postId: 'post_e2e_1' });

    await page.getByRole('button', { name: /Options de publication/i }).click();
    await page.getByRole('menuitem', { name: /Publier maintenant/i }).click();
    await expect(page.getByTestId('publish-confirm-preview')).toBeVisible();
    await page.getByRole('button', { name: /Confirmer/i }).click();

    await expect(page.getByText(/Publication lancée/i)).toBeVisible();
    expect(state.calls.publishNow).toBe(1);
  });
});
```

## Helpers partagés

Voir `e2e/social-publishing/helpers.ts` — fichier source unique pour mocks, navigation, assertions communes.

## Workers
- Default 2
- `@live` spec : workers=1, --grep @live

## Commande
```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 \
  npx playwright test e2e/social-publishing/*.spec.ts --grep -v @live --reporter=list
```
