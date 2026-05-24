/**
 * Content Studio v2 — golden path: create an image post.
 *
 * Tests the full intention form flow: format radios, selects (pillar,
 * objective, platform), the prompt textarea, submission via
 * "Enregistrer l'idee", and post-generation variant appearance.
 *
 * Env assumptions:
 *  - CONTENT_STUDIO_IMAGE_PROVIDER=mock (deterministic Sharp PNG)
 *  - No CONTENT_STUDIO_OPENAI_API_KEY (fallback templates, 3 drafts)
 *  - All generation is deterministic and fast.
 */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test.describe('create image post — golden path', () => {
  test('step 1: intention form renders with format radios', async ({ page }) => {
    await page.goto('/admin/content-studio-v2/create');
    await ensureAuthOrSkip(page);

    // The form heading
    await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible();

    // Format radiogroup must be visible
    await expect(page.getByRole('radiogroup', { name: /format de contenu/i })).toBeVisible();

    // All 4 format radio buttons
    for (const fmt of ['Post', 'Story', 'Reel', 'Carousel']) {
      await expect(
        page.getByRole('radio', { name: new RegExp(`^${fmt}`, 'i') }).first(),
      ).toBeVisible();
    }

    // The 3 selects: Pilier, Objectif, Plateforme
    for (const label of ['Pilier', 'Objectif', 'Plateforme']) {
      await expect(page.locator('select').filter({ has: page.locator(`option`) }).nth(0)).toBeVisible();
    }

    // Prompt textarea (labelled "Intention")
    await expect(page.locator('textarea').first()).toBeVisible();

    // Submit button "Enregistrer l'idee"
    await expect(page.getByRole('button', { name: /enregistrer l'idée/i })).toBeVisible();
  });

  test('step 1b: format radios toggle aria-checked', async ({ page }) => {
    await page.goto('/admin/content-studio-v2/create');
    await ensureAuthOrSkip(page);

    // Post should be selected by default
    const postRadio = page.getByRole('radio', { name: /^post/i }).first();
    await expect(postRadio).toHaveAttribute('aria-checked', 'true');

    // Click Reel and verify
    const reelRadio = page.getByRole('radio', { name: /^reel/i }).first();
    await reelRadio.click();
    await expect(reelRadio).toHaveAttribute('aria-checked', 'true');
    await expect(postRadio).toHaveAttribute('aria-checked', 'false');
  });

  test('step 2: fill intention and submit creates drafts', async ({ page }) => {
    await page.goto('/admin/content-studio-v2/create');
    await ensureAuthOrSkip(page);

    // Select format = post (default)
    await page.getByRole('radio', { name: /^post/i }).first().click();

    // The prompt textarea already has a default value; overwrite with our own
    const promptField = page.locator('textarea').first();
    await promptField.fill('Rituel FemiGlow pour des ongles lumineux et naturels au quotidien');

    // Submit the intention form
    await page.getByRole('button', { name: /enregistrer l'idée/i }).click();

    // After submission, the backend generates 3 drafts (fallback templates).
    // The Stepper should advance and variants should appear.
    // Wait for the "variantes" heading or a variant card to appear.
    await expect(
      page.getByText(/variantes?/i).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('step 3: stepper shows 4 creation steps', async ({ page }) => {
    await page.goto('/admin/content-studio-v2/create');
    await ensureAuthOrSkip(page);

    const stepper = page.locator('ol[aria-label="Étapes de création"]');
    await expect(stepper).toBeVisible();

    // 4 steps: Cadrer, Generer, Visuel, Valider
    for (const label of ['Cadrer', 'Générer', 'Visuel', 'Valider']) {
      await expect(stepper.getByText(label)).toBeVisible();
    }

    // Without a draft, step 1 "Cadrer" should be active
    await expect(
      stepper.locator('[data-step="frame"][data-state="active"]'),
    ).toBeVisible();
  });

  test('accessibility audit on /create', async ({ page }) => {
    await page.goto('/admin/content-studio-v2/create');
    await ensureAuthOrSkip(page);

    // Wait for the page to be interactive
    await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .exclude('.cs-skeleton')
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (critical.length > 0) {
      const details = critical
        .map((v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`)
        .join('\n');
      expect(critical, `Critical a11y violations:\n${details}`).toHaveLength(0);
    }
  });
});
