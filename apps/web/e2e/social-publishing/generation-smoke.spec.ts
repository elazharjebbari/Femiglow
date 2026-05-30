/**
 * Smoke test générations réelles (sans page.route mocks).
 *
 * But: reproduire le bug "rien ne se génère" rapporté sur staging.
 * Capture les erreurs console/network pour diagnostic.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Generation smoke (real backend)', () => {
  test('idea → variants → image generation', async ({ page }) => {
    test.setTimeout(120_000);

    const consoleErrors: string[] = [];
    const networkFails: Array<{ url: string; status: number; body: string }> = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('response', async (resp) => {
      const url = resp.url();
      if (
        url.includes('/api/admin/content-studio/') &&
        resp.status() >= 400 &&
        resp.status() !== 401 &&
        !url.includes('/postiz/')
      ) {
        let body = '';
        try {
          body = (await resp.text()).slice(0, 500);
        } catch {
          body = '<unreadable>';
        }
        networkFails.push({ url, status: resp.status(), body });
      }
    });

    await page.goto('/admin/content-studio-v2/create');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the IntentionForm
    await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible({
      timeout: 15_000,
    });

    // Wait a moment to let any pre-existing toasts dismiss
    await page.waitForTimeout(2000);

    // Capture state of API calls AFTER submit only
    const responsesAfterSubmit: Array<{ url: string; status: number; body: string }> = [];
    const captureFn = async (resp: import('@playwright/test').Response) => {
      const url = resp.url();
      if (url.includes('/api/admin/content-studio/')) {
        let body = '';
        try {
          body = (await resp.text()).slice(0, 500);
        } catch {
          body = '<unreadable>';
        }
        responsesAfterSubmit.push({ url, status: resp.status(), body });
      }
    };

    // Step 1: Submit idea (format passed via env var to test both)
    const fmt = process.env.SMOKE_FORMAT ?? 'post';
    await page.locator(`button[role="radio"][data-format="${fmt}"]`).click().catch(() => {});
    const textarea = page.getByRole('textbox').first();
    await textarea.fill(
      'Présenter le rituel du soir FemiGlow comme un geste lent et apaisant.',
    );

    // Now start capturing
    page.on('response', captureFn);
    await page.getByRole('button', { name: /Enregistrer l'idée/i }).click();

    // Step 2: Wait variants — give 30s
    let outcome: 'variants' | 'timeout' = 'timeout';
    try {
      await page
        .locator('[data-variant-id]')
        .first()
        .waitFor({ state: 'visible', timeout: 45_000 });
      outcome = 'variants';
    } catch {
      // timeout — fallback
    }

    // Diagnostics: dump everything
    console.log('\n=== DIAGNOSTIC ===');
    console.log('Outcome:', outcome);
    console.log('API responses after submit:');
    for (const r of responsesAfterSubmit) {
      console.log(`  [${r.status}] ${r.url.replace(/^.*?\/api\//, '/api/')}`);
      if (r.status >= 400) console.log('    body:', r.body);
    }
    console.log('Console errors:', consoleErrors.slice(0, 10));

    // Capture screenshot
    await page.screenshot({ path: 'test-results/gen-smoke-state.png', fullPage: true });

    expect(outcome, 'Variants should appear (or known error toast)').not.toBe('timeout');

    if (outcome === 'variants') {
      // Clear captures so we can isolate post-variant requests
      responsesAfterSubmit.length = 0;

      // Step 3: Select variant — triggers auto-review
      await page.getByRole('button', { name: /Choisir cette variante/i }).first().click();
      await page.waitForTimeout(2000);

      console.log('\nAfter variant select — API responses:');
      for (const r of responsesAfterSubmit) {
        console.log(`  [${r.status}] ${r.url.replace(/^.*?\/api\//, '/api/')}`);
        if (r.status >= 400) console.log('    body:', r.body);
      }

      responsesAfterSubmit.length = 0;

      // Step 4: Try generating visual
      const genBtn = page.getByRole('button', { name: /Générer un visuel IA/i });
      await expect(genBtn).toBeVisible({ timeout: 10_000 });
      await genBtn.click();
      await page.waitForTimeout(8000);

      console.log('\nAfter Générer click — API responses:');
      for (const r of responsesAfterSubmit) {
        console.log(`  [${r.status}] ${r.url.replace(/^.*?\/api\//, '/api/')}`);
        console.log('    body:', r.body.slice(0, 300));
      }

      // Toast detection
      const toastTexts = await page.locator('[data-sonner-toast]').allTextContents();
      console.log('\nToasts visible:', toastTexts);

      // Visual present? Detailed audit
      const visualCount = await page.locator('video, img[src*="_media"], [data-media-id]').count();
      console.log('Visual elements on page:', visualCount);

      const allImgs = await page.locator('img').all();
      console.log('All <img> srcs:');
      for (const img of allImgs.slice(0, 10)) {
        const src = await img.getAttribute('src').catch(() => null);
        const visible = await img.isVisible().catch(() => false);
        console.log(`  - src="${src}" visible=${visible}`);
      }

      const allVideos = await page.locator('video').all();
      console.log('All <video> srcs:');
      for (const v of allVideos) {
        const src = await v.getAttribute('src').catch(() => null);
        const visible = await v.isVisible().catch(() => false);
        console.log(`  - src="${src}" visible=${visible}`);
      }

      // Specifically: PreviewPane
      const previewPane = page.locator('aside[aria-label="Aperçu"]');
      const previewVisible = await previewPane.isVisible().catch(() => false);
      console.log('PreviewPane visible:', previewVisible);

      const previewImg = previewPane.locator('img, video').first();
      const previewImgVisible = await previewImg.isVisible().catch(() => false);
      console.log('Preview <img> or <video> visible:', previewImgVisible);

      // MediaStudio: bound media indicator?
      const mediaStudio = page.locator('section[aria-label="Studio média"]');
      const decroBtn = await mediaStudio.getByRole('button', { name: /Décrocher/i }).count();
      console.log('Décrocher button visible (=media is bound):', decroBtn > 0);

      await page.screenshot({ path: 'test-results/gen-smoke-visual.png', fullPage: true });
    }
  });
});
