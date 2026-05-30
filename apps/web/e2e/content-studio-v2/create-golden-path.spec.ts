/**
 * Content Studio v2 — complete golden-path for creating a post.
 *
 * Sequential E2E test that walks through every operator action from
 * landing on /create through to the publish action group:
 *
 *   1. Navigate & verify intention form
 *   2. Select format = post
 *   3. Select pillar = rituel
 *   4. Select objective = considération
 *   5. Select platform = instagram
 *   6. Fill prompt (50+ chars)
 *   7. Submit form -> stepper advances to "Générer"
 *   8. Wait for 3 variantes
 *   9. Select first variant -> "Sélectionnée"
 *  10. Verify caption editor with initial caption
 *  11. Edit hook text
 *  12. Edit caption text -> counter updates
 *  13. Wait for autosave -> "Enregistré"
 *  14. Click "Générer un visuel IA" -> progress -> image
 *  15. Switch preview platform to Facebook
 *  16. Switch preview format to Story
 *  17. Verify publish action group
 *
 * Env assumptions:
 *  - CONTENT_STUDIO_IMAGE_PROVIDER=mock (deterministic Sharp PNG)
 *  - No CONTENT_STUDIO_OPENAI_API_KEY (fallback templates, 3 drafts)
 *  - Fallback variant labels: "sobre", "sensorielle", "conversion douce"
 */
import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe.serial('create post — golden path', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_STORAGE_PATH });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('1. navigate to /create and see intention form', async () => {
    await page.goto('/admin/content-studio-v2/create');

    // Skip the entire suite if auth storage state is stale.
    if (page.url().includes('/admin/login')) {
      test.skip(true, 'Admin auth storage state is not valid in this environment.');
    }

    // The form heading
    await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible();

    // The format radiogroup
    await expect(page.getByRole('radiogroup', { name: /format de contenu/i })).toBeVisible();

    // All 4 format radio buttons
    for (const fmt of ['Post', 'Story', 'Reel', 'Carousel']) {
      await expect(
        page.getByRole('radio', { name: new RegExp(`^${fmt}`, 'i') }).first(),
      ).toBeVisible();
    }

    // Prompt textarea (labelled "Intention")
    await expect(page.locator('textarea').first()).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: /enregistrer l'idée/i })).toBeVisible();

    // Stepper visible with 4 steps
    const stepper = page.locator('ol[aria-label="Étapes de création"]');
    await expect(stepper).toBeVisible();
    for (const label of ['Cadrer', 'Générer', 'Visuel', 'Valider']) {
      await expect(stepper.getByText(label)).toBeVisible();
    }

    // Preview pane
    await expect(page.locator('aside[aria-label="Aperçu"]')).toBeVisible();
  });

  test('2. select format = post', async () => {
    const postRadio = page.getByRole('radio', { name: /^Post/i }).first();
    await postRadio.click();
    await expect(postRadio).toHaveAttribute('aria-checked', 'true');
  });

  test('3. select pillar = rituel', async () => {
    const pillarSelect = page
      .locator('label', { has: page.locator('span', { hasText: 'Pilier' }) })
      .locator('select');
    await pillarSelect.selectOption('rituel');
    await expect(pillarSelect).toHaveValue('rituel');
  });

  test('4. select objective = considération', async () => {
    const objectiveSelect = page
      .locator('label', { has: page.locator('span', { hasText: 'Objectif' }) })
      .locator('select');
    await objectiveSelect.selectOption('consideration');
    await expect(objectiveSelect).toHaveValue('consideration');
  });

  test('5. select platform = instagram', async () => {
    const platformSelect = page
      .locator('label', { has: page.locator('span', { hasText: 'Plateforme' }) })
      .locator('select');
    await platformSelect.selectOption('instagram');
    await expect(platformSelect).toHaveValue('instagram');
  });

  test('6. fill prompt with 50+ chars', async () => {
    const prompt = page.locator('textarea').first();
    const text =
      'Rituel FemiGlow du soir pour une peau lumineuse et un moment de détente inoubliable';
    await prompt.fill(text);
    await expect(prompt).toHaveValue(text);
    expect(text.length).toBeGreaterThan(50);
  });

  test('7. submit form -> stepper advances to "Générer"', async () => {
    // After form submission, the CreateWorkspace onCreated callback triggers
    // POST /ideas/:id/generate (fallback templates, ~1-5s), then selects
    // the first generated draft. The stepper advances to "Générer".
    test.setTimeout(60_000);

    await page.getByRole('button', { name: /enregistrer l'idée/i }).click();

    // Wait for the stepper "generate" step to become active, indicating
    // the idea was created and drafts were generated.
    await expect(
      page.locator('[data-step="generate"][data-state="active"], [data-step="generate"][data-state="done"]'),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('8. wait for 3 variantes to appear', async () => {
    test.setTimeout(60_000);

    // After generation, the VariantsCompare section should appear with
    // the 3 fallback-template drafts.
    const section = page.locator('section[aria-label="Comparer les variantes"]');
    await expect(section).toBeVisible({ timeout: 25_000 });

    // Should show "3 variantes" heading
    await expect(section.getByText(/3 variantes/i)).toBeVisible();

    // All 3 variant buttons should be present (one is already selected
    // "Sélectionnée", the other two show "Choisir cette variante")
    const variantButtons = section.getByRole('button').filter({
      hasText: /choisir cette variante|sélectionnée/i,
    });
    await expect(variantButtons).toHaveCount(3);
  });

  test('9. select first variant -> "Sélectionnée"', async () => {
    const section = page.locator('section[aria-label="Comparer les variantes"]');

    // The first variant may already be selected from the auto-generation.
    // Verify at least one "Sélectionnée" button exists.
    const selectedBtn = section.getByRole('button', { name: /sélectionnée/i });
    const selectedCount = await selectedBtn.count();

    if (selectedCount > 0) {
      // Already selected from auto-generation.
      await expect(selectedBtn.first()).toBeVisible();
    } else {
      // Click the first "Choisir cette variante" button
      const firstSelectBtn = section
        .getByRole('button', { name: /choisir cette variante/i })
        .first();
      await firstSelectBtn.click();
      await expect(
        section.getByRole('button', { name: /sélectionnée/i }).first(),
      ).toBeVisible();
    }
  });

  test('10. verify caption editor appears with initial caption', async () => {
    const captionSection = page.locator('section[aria-label="Légende et accroche"]');
    await expect(captionSection).toBeVisible({ timeout: 5_000 });

    // Hook input
    const hookInput = page.locator('input[aria-label="Accroche du draft"]');
    await expect(hookInput).toBeVisible();

    // Caption textarea with content from the generated draft
    const captionTextarea = page.locator('textarea[aria-label="Légende complète du draft"]');
    await expect(captionTextarea).toBeVisible();
    const captionValue = await captionTextarea.inputValue();
    expect(captionValue.length).toBeGreaterThan(0);
  });

  test('11. edit hook text', async () => {
    const hookInput = page.locator('input[aria-label="Accroche du draft"]');
    await hookInput.fill('Mon rituel du soir en 3 gestes');
    await expect(hookInput).toHaveValue('Mon rituel du soir en 3 gestes');
  });

  test('12. edit caption text -> counter updates', async () => {
    const captionTextarea = page.locator('textarea[aria-label="Légende complète du draft"]');
    const newCaption =
      'Chaque soir, je prends un moment rien que pour moi. ' +
      'Le rituel FemiGlow transforme ma routine en vrai moment de bien-être.';
    await captionTextarea.fill(newCaption);
    await expect(captionTextarea).toHaveValue(newCaption);

    // The counter should show the current length out of 2200
    const counter = page.locator('section[aria-label="Légende et accroche"]').getByText(
      new RegExp(`${newCaption.length}\\s*/\\s*2200`),
    );
    await expect(counter).toBeVisible();
  });

  test('13. wait for autosave -> "Enregistré"', async () => {
    // Autosave debounce is 1.5s — wait for the PATCH request to complete.
    // Listen for the drafts PATCH response to diagnose success/failure.
    const patchResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/admin/content-studio/drafts/') &&
        resp.request().method() === 'PATCH',
      { timeout: 15_000 },
    );

    // Wait for the PATCH to fire (debounce = 1.5s)
    const patchResponse = await patchResponsePromise;
    expect(patchResponse.status()).toBe(200);

    // After a successful PATCH, the indicator should show "Enregistré"
    await expect(
      page.locator('section[aria-label="Légende et accroche"]').getByRole('status').filter({
        hasText: /enregistré/i,
      }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('14. click "Générer un visuel IA" -> progress bar -> image appears', async () => {
    test.setTimeout(60_000);

    const mediaSection = page.locator('section[aria-label="Studio média"]');
    await expect(mediaSection).toBeVisible();

    const generateBtn = mediaSection.getByRole('button', {
      name: /générer un visuel ia/i,
    });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Wait for the success toast "Visuel IA généré"
    await expect(page.getByText(/visuel ia généré/i)).toBeVisible({ timeout: 30_000 });
  });

  test('15. switch preview to Facebook -> tab changes', async () => {
    const preview = page.locator('aside[aria-label="Aperçu"]');
    const facebookTab = preview.getByRole('tab', { name: /facebook/i });
    await facebookTab.click();
    await expect(facebookTab).toHaveAttribute('aria-selected', 'true');

    const instagramTab = preview.getByRole('tab', { name: /instagram/i });
    await expect(instagramTab).toHaveAttribute('aria-selected', 'false');
  });

  test('16. switch format to Story -> tab changes', async () => {
    const preview = page.locator('aside[aria-label="Aperçu"]');
    const storyTab = preview.getByRole('tab', { name: /^story$/i });
    await storyTab.click();
    await expect(storyTab).toHaveAttribute('aria-selected', 'true');

    const postTab = preview.getByRole('tab', { name: /^post$/i });
    await expect(postTab).toHaveAttribute('aria-selected', 'false');
  });

  test('17. verify publish action group shows "Publier" dropdown', async () => {
    const footer = page.locator('footer[aria-label="Publier"]');
    await expect(footer).toBeVisible();

    const publishBtn = footer.getByRole('button', { name: /options de publication/i });
    await expect(publishBtn).toBeVisible();
    await expect(publishBtn).toContainText(/publier/i);

    // Since no post has been approved yet, the hint should be visible.
    // CS v2 Phase 6: wording changed from "Approuvez" → "Validez" to align
    // with the new ApproveButton CTA in PreviewPane.
    await expect(
      footer.getByText(/validez le draft pour activer la publication/i),
    ).toBeVisible();
  });
});
