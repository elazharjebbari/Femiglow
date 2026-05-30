/**
 * CS v2 create-audit Phase 7 — golden path covered with full API mocking.
 *
 * Mirrors `create-golden-path.spec.ts` but mocks every backend call via
 * `page.route`, so it runs deterministically without depending on a
 * specific server config (CONTENT_STUDIO_IMAGE_PROVIDER=mock, no OpenAI
 * key, etc.). Verifies the create-audit additions: model picker, kind
 * toggle, ApproveButton, MockModeBadge.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerCreateMocks, ensureCreatePageLoaded } from './create-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Content Studio v2 — create golden path (mocked)', () => {
  test('complete idea → variants → media → approve → publish', async ({ page }) => {
    const state = await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    // Mock-mode badge surfaced from /health.
    await expect(page.getByRole('status', { name: /Mode mock activé/i }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Step 1 — fill intention form (reel format).
    await page.getByRole('radio', { name: /Reel/i }).click();
    await page
      .getByRole('textbox')
      .first()
      .fill('Présenter le rituel du soir comme un geste lent et apaisant.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();

    // Step 2 — three variants appear with the "Généré par" badge.
    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-variant-id]')).toHaveCount(3);
    await expect(page.getByTestId('generated-by-badge')).toBeVisible();

    // Step 3 — pick the first variant → server auto-review puts it in needs_review.
    await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();

    // Step 4 — generate visual (defaults to video for reel).
    await page.getByRole('button', { name: /Générer un visuel IA/i }).click();
    await expect(page.locator('video, img').first()).toBeVisible({ timeout: 15_000 });

    // Step 5 — approve & publish.
    const approve = page.getByTestId('approve-draft-button');
    await expect(approve).toBeEnabled();
    await approve.click();
    await expect(page.getByText(/Draft validé/i)).toBeVisible({ timeout: 5_000 });
    expect(state.approveCalled).toBe(true);

    // Wait for the Publier dropdown to become enabled after the post is upserted
    // into context. `disabled` toggles in the same render as setPosts but the
    // Radix Dropdown trigger reflects it through `aria-disabled`/native disabled.
    const publishTrigger = page.getByRole('button', { name: /Options de publication/i });
    await expect(publishTrigger).toBeEnabled({ timeout: 5_000 });
    await publishTrigger.click();
    await page.getByRole('menuitem', { name: /Publier maintenant/i }).click();
    await page.getByRole('button', { name: /Confirmer/i }).click();
    await expect(page.getByText(/Publication lancée/i)).toBeVisible({ timeout: 5_000 });
    expect(state.publishNowCalled).toBe(true);
  });

  test('forwards chosen model to POST /ideas and /ideas/:id/generate', async ({ page }) => {
    const state = await registerCreateMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await ensureCreatePageLoaded(page);

    await page.getByRole('radio', { name: /Reel/i }).click();
    await page.getByTestId('intention-form-model-picker').click();
    await page.getByTestId('model-picker-item-gpt-4o').click();
    await page.getByRole('textbox').first().fill('Intention détaillée pour la création.');
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();

    await expect(page.locator('[data-variant-id]').first()).toBeVisible({ timeout: 15_000 });
    expect(state.lastIdeasBody?.model).toBe('gpt-4o');
    expect(state.lastGenerateBody?.model).toBe('gpt-4o');
  });
});
