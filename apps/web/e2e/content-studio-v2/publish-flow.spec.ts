/**
 * Content Studio v2 — publish flow (PublishActionGroup).
 *
 * Tests the dropdown menu, confirm dialogs, and toast feedback for
 * "Publier maintenant", "Programmer", and "Brouillon Postiz".
 *
 * Strategy: go through a minimal golden path (submit idea -> generate
 * -> draft selected), then use `window.__STUDIO_CTX__` (exposed by the
 * StudioProvider for E2E purposes) to call `setPosts()` and populate
 * a mock approved post matching the selected draft's ID.
 *
 * All publish API calls are intercepted via `page.route()`.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_POST_ID = 'post-e2e-publish-001';

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

/**
 * Submit the intention form, wait for drafts to generate, then inject
 * a mock post via the exposed StudioContext to enable publishing.
 */
async function navigateAndEnablePublish(page: import('@playwright/test').Page) {
  const mockDraftId = `draft-e2e-${Date.now()}`;

  // Mock the idea creation and generate endpoints for fast draft creation
  await page.route(/\/api\/admin\/content-studio\/ideas$/, (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        idea: {
          id: `idea-e2e-${Date.now()}`,
          prompt: 'Test publish flow',
          pillar: 'rituel',
          objective: 'consideration',
          platform: 'instagram',
          format: 'post',
          status: 'generated',
          createdAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route(/\/api\/admin\/content-studio\/ideas\/[^/]+\/generate/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        drafts: [
          {
            id: mockDraftId,
            briefId: `brief-e2e-${Date.now()}`,
            caption: 'Caption pour test publish flow',
            hook: 'Hook test',
            format: 'post',
            platform: 'instagram',
            tone: 'sobre',
            label: 'sobre',
            scoreTotal: 85,
            status: 'approved',
            hashtags: [],
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    }),
  );

  // Autosave PATCH mock
  await page.route(/\/api\/admin\/content-studio\/drafts\/[^/]+$/, (route) => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ draft: { id: mockDraftId } }),
      });
    }
    return route.continue();
  });

  await page.goto('/admin/content-studio-v2/create');
  await ensureAuthOrSkip(page);

  // Wait for workspace
  await expect(page.getByRole('heading', { name: /quelle intention/i })).toBeVisible({ timeout: 10_000 });

  // Submit the intention form
  await page.getByRole('button', { name: /enregistrer l'idée/i }).click();

  // Wait for the caption editor to appear (= draft was selected and rendered)
  await expect(page.locator('section[aria-label="Légende et accroche"]')).toBeVisible({ timeout: 15_000 });

  // Use the exposed __STUDIO_CTX__ to inject a mock post.
  // The setPosts setter from useStudio() populates the posts array,
  // enabling the PublishActionGroup button.
  const injected = await page.evaluate((args) => {
    const ctx = (window as any).__STUDIO_CTX__;
    if (!ctx || typeof ctx.setPosts !== 'function') return false;
    ctx.setPosts([{
      id: args.postId,
      draftId: args.draftId,
      status: 'approved',
      createdAt: new Date().toISOString(),
    }]);
    return true;
  }, { postId: MOCK_POST_ID, draftId: mockDraftId });

  if (!injected) {
    test.skip(true, 'window.__STUDIO_CTX__ not available — requires rebuilt app with test hook.');
  }

  // Wait for the publish button to become enabled
  const footer = page.locator('footer[aria-label="Publier"]');
  await expect(footer).toBeVisible({ timeout: 5_000 });

  const publishBtn = footer.getByRole('button', { name: /options de publication/i });
  await expect(publishBtn).toBeEnabled({ timeout: 10_000 });

  return { footer, publishBtn, mockDraftId };
}

test.describe('publish flow — PublishActionGroup', () => {
  test('with approved post: dropdown "Publier" is enabled and shows 3 options', async ({ page }) => {
    test.setTimeout(60_000);
    const { publishBtn } = await navigateAndEnablePublish(page);

    await publishBtn.click();

    await expect(page.getByText('Publier maintenant')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Programmer')).toBeVisible();
    await expect(page.getByText('Brouillon Postiz')).toBeVisible();
  });

  test('"Publier maintenant" -> confirm dialog -> mock POST -> toast', async ({ page }) => {
    test.setTimeout(60_000);

    await page.route(new RegExp(`/api/admin/content-studio/posts/${MOCK_POST_ID}/publish-now`), (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }),
    );

    const { publishBtn } = await navigateAndEnablePublish(page);
    await publishBtn.click();
    await page.getByText('Publier maintenant').click();

    await expect(page.getByRole('heading', { name: /publier maintenant/i })).toBeVisible({ timeout: 3_000 });
    await page.getByRole('button', { name: /confirmer/i }).click();

    await expect(page.getByText('Publication lancée')).toBeVisible({ timeout: 5_000 });
  });

  test('"Publier maintenant" -> mock 422 -> toast error with message', async ({ page }) => {
    test.setTimeout(60_000);

    await page.route(new RegExp(`/api/admin/content-studio/posts/${MOCK_POST_ID}/publish-now`), (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Aucun provider connecté' } }),
      }),
    );

    const { publishBtn } = await navigateAndEnablePublish(page);
    await publishBtn.click();
    await page.getByText('Publier maintenant').click();

    await expect(page.getByRole('heading', { name: /publier maintenant/i })).toBeVisible({ timeout: 3_000 });
    await page.getByRole('button', { name: /confirmer/i }).click();

    await expect(page.getByText(/Publication : Aucun provider connecté/i)).toBeVisible({ timeout: 5_000 });
  });

  test('"Programmer" -> datetime input -> mock POST -> toast', async ({ page }) => {
    test.setTimeout(60_000);

    await page.route(new RegExp(`/api/admin/content-studio/posts/${MOCK_POST_ID}/schedule`), (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }),
    );

    const { publishBtn } = await navigateAndEnablePublish(page);
    await publishBtn.click();
    await page.getByText('Programmer').click();

    await expect(page.getByRole('heading', { name: /programmer la publication/i })).toBeVisible({ timeout: 3_000 });

    const datetimeInput = page.locator('input[type="datetime-local"]');
    await expect(datetimeInput).toBeVisible();

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const futureStr = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
    await datetimeInput.fill(futureStr);

    await page.getByRole('button', { name: /^programmer$/i }).click();

    await expect(page.getByText('Publication programmée')).toBeVisible({ timeout: 5_000 });
  });

  test('"Brouillon Postiz" -> confirm -> mock POST -> toast', async ({ page }) => {
    test.setTimeout(60_000);

    await page.route(new RegExp(`/api/admin/content-studio/posts/${MOCK_POST_ID}/draft-on-provider`), (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }),
    );

    const { publishBtn } = await navigateAndEnablePublish(page);
    await publishBtn.click();
    await page.getByText('Brouillon Postiz').click();

    await expect(page.getByRole('heading', { name: /envoyer en brouillon/i })).toBeVisible({ timeout: 3_000 });
    await page.getByRole('button', { name: /^envoyer$/i }).click();

    await expect(page.getByText('Brouillon envoyé au provider')).toBeVisible({ timeout: 5_000 });
  });
});
