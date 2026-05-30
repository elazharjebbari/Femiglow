/**
 * Reproduit le bug "rien ne se génère" : click Générer SANS avoir
 * sélectionné une variante au préalable.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test('Generation without prior variant select', async ({ page }) => {
  test.setTimeout(90_000);

  const responses: Array<{ url: string; status: number; body: string }> = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('/api/admin/content-studio/')) {
      let body = '';
      try {
        body = (await resp.text()).slice(0, 300);
      } catch {
        body = '<unreadable>';
      }
      responses.push({ url, status: resp.status(), body });
    }
  });

  await page.goto('/admin/content-studio-v2/create');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(2000);

  // Try to click "Générer un visuel IA" without first generating ideas / selecting variant
  const genBtn = page.getByRole('button', { name: /Générer un visuel IA/i });

  const exists = await genBtn.count();
  console.log('\n=== INITIAL STATE ===');
  console.log('Generate visual button count:', exists);

  if (exists > 0) {
    const isVisible = await genBtn.isVisible();
    const isEnabled = await genBtn.isEnabled();
    console.log('  visible:', isVisible);
    console.log('  enabled:', isEnabled);

    if (isVisible && isEnabled) {
      responses.length = 0;
      await genBtn.click();
      await page.waitForTimeout(5000);

      console.log('\n=== AFTER CLICK ===');
      console.log('API calls:');
      for (const r of responses) {
        console.log(`  [${r.status}] ${r.url.replace(/^.*\/api\//, '/api/')}`);
        if (r.status >= 400) console.log('    body:', r.body);
      }
      const toasts = await page.locator('[data-sonner-toast]').allTextContents();
      console.log('Toasts:', toasts);
    }
  }

  await page.screenshot({ path: 'test-results/gen-no-variant.png', fullPage: true });
});
