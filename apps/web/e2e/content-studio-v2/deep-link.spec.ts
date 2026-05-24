/**
 * Content Studio v2 — Deep link tests for /create.
 *
 * Validates that the /create page renders correctly:
 *  1. Without any draftId — IntentionForm + Stepper on "Cadrer".
 *  2. With an invalid/nonexistent draftId param — no JS crash, page still works.
 *
 * The page component (`CreatePage`) is a Server Component that renders
 * `<CreateWorkspace />` without draftId URL params — the initialDraftId
 * prop is always null on the base /create route. We verify robustness.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test('deep-link — /create without draftId shows IntentionForm + stepper on Cadrer', async ({
  page,
}) => {
  await page.goto('/admin/content-studio-v2/create');
  await ensureAuthOrSkip(page);

  // IntentionForm heading visible
  await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible();

  // Stepper is visible, first step "Cadrer" is active
  const stepperList = page.getByRole('list', { name: /étapes de création/i });
  await expect(stepperList).toBeVisible();

  const cadrerStep = page.locator('[data-step="frame"]');
  await expect(cadrerStep).toHaveAttribute('data-state', 'active');
});

test('deep-link — /create with invalid draftId renders without JS crash', async ({ page }) => {
  // Try navigating to a nonexistent draftId via the dynamic route segment
  const consoleLogs: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleLogs.push(msg.text());
  });

  let pageError: Error | null = null;
  page.on('pageerror', (err) => {
    pageError = err;
  });

  await page.goto('/admin/content-studio-v2/create/nonexistent-draft-id-12345');
  // The page may 404 or render the create page — either is fine, no JS crash
  // is the key assertion. If it redirects to login, skip.
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }

  // Wait a moment for any deferred errors
  await page.waitForTimeout(2000);

  // No unhandled JS crash
  expect(pageError).toBeNull();

  // The page should still be functional — either a 404 page or the create workspace.
  // If it rendered the workspace, the IntentionForm should be present.
  const intentionForm = page.getByRole('heading', { name: /quelle intention/i });
  const notFoundText = page.getByText(/404|not found|page introuvable/i);
  const isWorkspace = await intentionForm.isVisible().catch(() => false);
  const is404 = await notFoundText.isVisible().catch(() => false);

  // At least one of these should be true — the page rendered something valid
  expect(isWorkspace || is404).toBeTruthy();
});
